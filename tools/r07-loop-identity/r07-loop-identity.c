#define _GNU_SOURCE
#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/loop.h>
#include <linux/version.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <unistd.h>
#if !defined(__linux__) || !defined(__x86_64__)
#error Linux_x86_64_required
#endif
_Static_assert(sizeof(void *) == 8, "pointer ABI");
_Static_assert(sizeof(dev_t) == 8, "dev_t ABI");
_Static_assert(sizeof(ino_t) == 8, "ino_t ABI");
_Static_assert(sizeof(off_t) == 8, "off_t ABI");
_Static_assert(sizeof(struct loop_info64) == 232, "loop ABI");
_Static_assert(offsetof(struct loop_info64, lo_device) == 0, "device ABI");
_Static_assert(offsetof(struct loop_info64, lo_inode) == 8, "inode ABI");
_Static_assert(offsetof(struct loop_info64, lo_offset) == 24, "offset ABI");
_Static_assert(offsetof(struct loop_info64, lo_sizelimit) == 32, "limit ABI");
_Static_assert(LOOP_GET_STATUS64 == 0x4c05, "ioctl ABI");
struct record {
    unsigned long id, parent;
    unsigned maj, min;
    char source[64], options[256];
};
struct snapshot { struct record outer, child; };
static int fail(const char *why) {
    #ifdef R07_TEST_HOOK
    R07_TEST_HOOK(why);
#endif
    fprintf(stderr, "R07_LOOP_IDENTITY_FAIL:%s\n", why);
    return -1;
}
static int number(const char *s, unsigned long max, unsigned long *out) {
    char *end; unsigned long v;
    if (!s || !*s) return -1;
    for (const unsigned char *p=(const unsigned char *)s; *p; ++p)
        if (*p<'0' || *p>'9') return -1;
    errno=0; v=strtoul(s,&end,10);
    if (errno || *end || v>max) return -1;
    *out=v; return 0;
}
static int device(char *s, unsigned *maj, unsigned *min) {
    char *colon=strchr(s,':'); unsigned long a,b;
    if (!colon || strchr(colon+1,':')) return -1;
    *colon=0;
    if (number(s,0xfff,&a) || number(colon+1,0xfffff,&b)) return -1;
    *maj=(unsigned)a; *min=(unsigned)b; return 0;
}
static int option(const char *s, const char *wanted) {
    size_t n=strlen(wanted);
    for (;;) {
        const char *end=strchr(s,',');
        size_t len=end ? (size_t)(end-s) : strlen(s);
        if (len==n && !memcmp(s,wanted,n)) return 1;
        if (!end) return 0;
        s=end+1;
    }
}
static int snapshot(const char *target, struct snapshot *out) {
    FILE *fp=fopen("/proc/self/mountinfo","re");
    char line[4096]; unsigned lines=0, outer=0, child=0; int bad=0;
    if (!fp) return fail("MOUNTINFO_OPEN");
    memset(out,0,sizeof(*out));
    while (fgets(line,sizeof(line),fp)) {
        char *f[256], *save=NULL; size_t n=0, sep; char *p;
        if (++lines>65536 || !strchr(line,'\n')) { bad=1; break; }
        p=strtok_r(line," \n",&save);
        while (p && n<256) { f[n++]=p; p=strtok_r(NULL," \n",&save); }
        if (p || n<10) { bad=1; break; }
        int which=!strcmp(f[4],"/mnt/cashback-r07") ? 1 :
                  !strcmp(f[4],target) ? 2 : 0;
        if (!which) continue;
        struct record *r=which==1 ? &out->outer : &out->child;
        if (which==1) ++outer; else ++child;
        for (sep=6;sep<n && strcmp(f[sep],"-");++sep) {}
        if (sep+3>=n || strcmp(f[3],"/") ||
            strcmp(f[sep+1],"ext4") ||
            number(f[0],ULONG_MAX,&r->id) || !r->id ||
            number(f[1],ULONG_MAX,&r->parent) ||
            device(f[2],&r->maj,&r->min) ||
            strlen(f[sep+2])>=sizeof(r->source) ||
            strlen(f[5])>=sizeof(r->options)) { bad=1; break; }
        strcpy(r->source,f[sep+2]); strcpy(r->options,f[5]);
        if (!option(r->options,"rw") || !option(r->options,"nodev") ||
            !option(r->options,"nosuid")) { bad=1; break; }
    }
    if (ferror(fp)) bad=1;
    if (fclose(fp)) bad=1;
    if (bad || outer!=1 || child!=1 || out->child.parent!=out->outer.id)
        return fail("MOUNTINFO_RECORD");
    return 0;
}
static int same_record(const struct record *a,const struct record *b) {
    return a->id==b->id && a->parent==b->parent &&
           a->maj==b->maj && a->min==b->min &&
           !strcmp(a->source,b->source) && !strcmp(a->options,b->options);
}
/* All components opened relative to held directory descriptors. */
static int secure_open(const char *path,int final_flags) {
    char copy[512], *save=NULL, *part, *next;
    int fd=-1, nextfd=-1;
    if (path[0]!='/' || strlen(path)>=sizeof(copy)) return fail("PATH_LENGTH");
    strcpy(copy,path+1);
    fd=open("/",O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if (fd<0) return fail("ROOT_OPEN");
    part=strtok_r(copy,"/",&save);
    if (!part) { close(fd); return fail("EMPTY_PATH"); }
    while (part) {
        if (!strcmp(part,".") || !strcmp(part,"..")) {
            close(fd); return fail("PATH_COMPONENT");
        }
        next=strtok_r(NULL,"/",&save);
        nextfd=openat(fd,part,(next ? O_PATH|O_DIRECTORY : final_flags) |
                              O_NOFOLLOW|O_CLOEXEC);
        int closed=close(fd);
        fd=-1;
        if (nextfd<0 || closed) {
            if (nextfd>=0) close(nextfd);
            return fail("PATH_OPEN_CLOSE");
        }
        fd=nextfd; nextfd=-1; part=next;
    }
    return fd;
}
static int same_file(const struct stat *a,const struct stat *b) {
    return a->st_dev==b->st_dev && a->st_ino==b->st_ino;
}
static int loop_identity(const struct loop_info64 *i,
                         const struct stat *s,unsigned loop_number) {
    uint64_t a=major(s->st_dev), b=minor(s->st_dev);
    if (a>0xfff || b>0xfffff) return fail("DEVICE_ENCODING");
    uint64_t encoded=(b&0xff) | (a<<8) | ((b&~UINT64_C(0xff))<<12);
    if (i->lo_device!=encoded || i->lo_inode!=(uint64_t)s->st_ino)
        return fail("BACKING_IDENTITY");
    if (i->lo_offset || i->lo_sizelimit || i->lo_number!=loop_number)
        return fail("LOOP_PARAMETERS");
    return 0;
}
static int verify(const char *target,const char *image,off_t size) {
    struct snapshot before,after;
    struct stat outer,mount,image_stat,current,reopened,block;
    struct loop_info64 info={0};
    int ofd=-1,mfd=-1,ifd=-1,lfd=-1,rfd=-1,result=-1;
    unsigned long loop_number=0;
    if (snapshot(target,&before)) goto done;
    if (strncmp(before.child.source,"/dev/loop",9) ||
        number(before.child.source+9,UINT_MAX,&loop_number)) {
        fail("LOOP_SOURCE"); goto done;
    }
    ofd=secure_open("/mnt/cashback-r07",O_PATH|O_DIRECTORY);
    mfd=secure_open(target,O_PATH|O_DIRECTORY);
    ifd=secure_open(image,O_PATH);
    if (ofd<0 || mfd<0 || ifd<0) goto done;
    if (fstat(ofd,&outer) || fstat(mfd,&mount) || fstat(ifd,&image_stat)) {
        fail("FSTAT"); goto done;
    }
    if (major(outer.st_dev)!=before.outer.maj ||
        minor(outer.st_dev)!=before.outer.min ||
        major(mount.st_dev)!=before.child.maj ||
        minor(mount.st_dev)!=before.child.min ||
        !S_ISREG(image_stat.st_mode) ||
        image_stat.st_dev!=outer.st_dev ||
        image_stat.st_size!=size) { fail("PATH_PROPERTIES"); goto done; }
    lfd=secure_open(before.child.source,O_RDONLY);
    if (lfd<0) goto done;
    if (fstat(lfd,&block) || !S_ISBLK(block.st_mode) ||
        major(block.st_rdev)!=before.child.maj ||
        minor(block.st_rdev)!=before.child.min) {
        fail("LOOP_DEVICE"); goto done;
    }
    if (ioctl(lfd,LOOP_GET_STATUS64,&info)) { fail("IOCTL"); goto done; }
    if (loop_identity(&info,&image_stat,(unsigned)loop_number)) goto done;
    if (stat(image,&current)) { fail("STAT_AGAIN"); goto done; }
    rfd=secure_open(image,O_PATH);
    if (rfd<0) goto done;
    if (fstat(rfd,&reopened) || !S_ISREG(reopened.st_mode) ||
        !same_file(&image_stat,&current) || !same_file(&image_stat,&reopened) ||
        current.st_size!=size || reopened.st_size!=size) {
        fail("IMAGE_CHANGED"); goto done;
    }
    memset(&info,0,sizeof(info));
    if (ioctl(lfd,LOOP_GET_STATUS64,&info)) { fail("IOCTL_AGAIN"); goto done; }
    if (loop_identity(&info,&image_stat,(unsigned)loop_number)) goto done;
    if (snapshot(target,&after)) goto done;
    if (!same_record(&before.outer,&after.outer) ||
        !same_record(&before.child,&after.child)) {
        fail("MOUNT_CHANGED"); goto done;
    }
    result=0;
done:
    if (rfd>=0 && close(rfd)) { fail("CLOSE"); result=-1; }
    if (lfd>=0 && close(lfd)) { fail("CLOSE"); result=-1; }
    if (ifd>=0 && close(ifd)) { fail("CLOSE"); result=-1; }
    if (mfd>=0 && close(mfd)) { fail("CLOSE"); result=-1; }
    if (ofd>=0 && close(ofd)) { fail("CLOSE"); result=-1; }
    return result;
}
int main(int argc,char **argv) {
    (void)argv;
    if (argc!=1) { fail("ARGUMENTS"); return 1; }
    if (verify("/mnt/cashback-r07/postgres",
               "/mnt/cashback-r07/postgres-3g.img",(off_t)3221225472) ||
        verify("/mnt/cashback-r07/avatars",
               "/mnt/cashback-r07/avatars-256m.img",(off_t)268435456))
        return 1;
    puts("R07_LOOP_IDENTITY_PASS");
    return 0;
}
