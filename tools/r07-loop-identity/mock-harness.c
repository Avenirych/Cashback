#define _GNU_SOURCE
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <linux/loop.h>
#include <linux/version.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <unistd.h>
static const char *observed_reason;
static void record_failure(const char *why) { observed_reason=why; }
#define R07_TEST_HOOK(why) record_failure(why)
static int mock_open(const char *,int,...);
static int mock_openat(int,const char *,int,...);
static int mock_fstat(int,struct stat *);
static int mock_stat(const char *,struct stat *);
static int mock_ioctl(int,unsigned long,...);
static int mock_close(int);
static FILE *mock_fopen(const char *,const char *);
static int mock_ferror(FILE *);
static int mock_fclose(FILE *);
#define main helper_main
#define open(...) mock_open(__VA_ARGS__)
#define openat(...) mock_openat(__VA_ARGS__)
#define fstat(...) mock_fstat(__VA_ARGS__)
#define stat(...) mock_stat(__VA_ARGS__)
#define ioctl(...) mock_ioctl(__VA_ARGS__)
#define close(...) mock_close(__VA_ARGS__)
#define fopen(...) mock_fopen(__VA_ARGS__)
#define ferror(...) mock_ferror(__VA_ARGS__)
#define fclose(...) mock_fclose(__VA_ARGS__)
#include "r07-loop-identity.c"
#undef R07_TEST_HOOK
#undef main
#undef open
#undef openat
#undef fstat
#undef stat
#undef ioctl
#undef close
#undef fopen
#undef ferror
#undef fclose
enum {NORMAL,INODE_BAD,DEVICE_BAD,OFFSET_BAD,LIMIT_BAD,NUMBER_BAD,
      SYMLINK_IMAGE,SYMLINK_PARENT,SIZE_BAD,BLOCK_BAD,REPLACED,
      MOUNT_CHANGED,MISSING_MOUNT,DUPLICATE_MOUNT,BAD_TYPE,
      OVERFLOW_DEVICE,LONG_LINE,MANY_FIELDS,NO_NEWLINE,BAD_OPTIONS};
enum {OP_OPEN,OP_OPENAT,OP_FSTAT,OP_STAT,OP_IOCTL,OP_CLOSE,OP_FOPEN,OP_FERROR,OP_FCLOSE,OPS};
static int scenario, fault_op=-1, fault_at, calls[OPS], live[10], violations;
static int fault(int op) {
    ++calls[op];
    if(op==fault_op && calls[op]==fault_at) {errno=EIO;return 1;}
    return 0;
}
static int acquire(int fd) {++live[fd-100];return fd;}
static int mock_open(const char *p,int flags,...) {
    if (flags&(O_WRONLY|O_RDWR|O_CREAT|O_TRUNC|O_APPEND)) ++violations;
    if (fault(OP_OPEN)) return -1;
    if (strcmp(p,"/") || !(flags&O_DIRECTORY) || !(flags&O_NOFOLLOW)) {
        ++violations;errno=EINVAL;return -1;
    }
    return acquire(100);
}
static int mock_openat(int fd,const char *p,int flags,...) {
    int out=-1;
    if (flags&(O_WRONLY|O_RDWR|O_CREAT|O_TRUNC|O_APPEND)) ++violations;
    if (!(flags&O_NOFOLLOW)) ++violations;
    if (fault(OP_OPENAT)) return -1;
    if(fd==100 && !strcmp(p,"mnt")) out=101;
    if(fd==100 && !strcmp(p,"dev")) out=107;
    if(fd==101 && !strcmp(p,"cashback-r07")) {
        if(scenario==SYMLINK_PARENT){errno=ENOTDIR;return -1;}
        out=102;
    }
    if(fd==102 && !strcmp(p,"postgres")) out=103;
    if(fd==102 && !strcmp(p,"avatars")) out=104;
    if(fd==102 && !strcmp(p,"postgres-3g.img")) out=105;
    if(fd==102 && !strcmp(p,"avatars-256m.img")) out=106;
    if(fd==107 && !strcmp(p,"loop17")) out=108;
    if(fd==107 && !strcmp(p,"loop29")) out=109;
    if(out<0){++violations;errno=ENOENT;return -1;}
    if((out<=104 || out==107) && !(flags&O_DIRECTORY))++violations;
    if(out<=106 && !(flags&O_PATH))++violations;
    if(out>=108 && (flags&O_PATH))++violations;
    return acquire(out);
}
static int fill_stat(int fd,struct stat *s) {
    memset(s,0,sizeof(*s));
    s->st_mode=S_IFDIR|0700; s->st_dev=makedev(8,16);
    if(fd==103) s->st_dev=makedev(7,17);
    if(fd==104) s->st_dev=makedev(7,29);
    if(fd==105 || fd==106) {
        s->st_mode=(scenario==SYMLINK_IMAGE ? S_IFLNK : S_IFREG)|0600;
        s->st_ino=fd==105 ? 13 : 14;
        s->st_size=fd==105 ? (off_t)3221225472 : (off_t)268435456;
        if(scenario==SIZE_BAD) --s->st_size;
    }
    if(fd==108 || fd==109) {
        s->st_mode=S_IFBLK|0600;
        s->st_rdev=makedev(7,fd==108 ? 17 : 29);
        if(scenario==BLOCK_BAD) s->st_rdev=makedev(7,99);
    }
    return 0;
}
static int mock_fstat(int fd,struct stat *s) {
    if(fault(OP_FSTAT))return -1;
    if(fd<100 || fd>109 || !live[fd-100]){++violations;return -1;}
    return fill_stat(fd,s);
}
static int mock_stat(const char *p,struct stat *s) {
    if(fault(OP_STAT))return -1;
    int fd=!strcmp(p,"/mnt/cashback-r07/postgres-3g.img") ? 105 :
           !strcmp(p,"/mnt/cashback-r07/avatars-256m.img") ? 106 : -1;
    if(fd<0){++violations;return -1;}
    fill_stat(fd,s);
    if(scenario==REPLACED)++s->st_ino;
    return 0;
}
static int mock_ioctl(int fd,unsigned long request,...) {
    va_list args;
    if(request!=LOOP_GET_STATUS64 || (fd!=108 && fd!=109)) {
        ++violations;errno=EINVAL;return -1;
    }
    if(fault(OP_IOCTL))return -1;
    va_start(args,request);
    struct loop_info64 *i=va_arg(args,struct loop_info64 *);
    va_end(args);
    memset(i,0,sizeof(*i));
    i->lo_device=0x810; /* Linux new_encode_dev(8,16). */
    i->lo_inode=fd==108 ? 13 : 14;
    i->lo_number=fd==108 ? 17 : 29;
    if(scenario==INODE_BAD)++i->lo_inode;
    if(scenario==DEVICE_BAD)++i->lo_device;
    if(scenario==OFFSET_BAD)i->lo_offset=4096;
    if(scenario==LIMIT_BAD)i->lo_sizelimit=4096;
    if(scenario==NUMBER_BAD)++i->lo_number;
    return 0;
}
static int mock_close(int fd) {
    int broken=fault(OP_CLOSE);
    if(fd<100 || fd>109 || live[fd-100]<=0)++violations;
    else --live[fd-100];
    return broken ? -1 : 0;
}
static FILE *mock_fopen(const char *p,const char *mode) {
    static char text[16000];
    if(fault(OP_FOPEN))return NULL;
    if(strcmp(p,"/proc/self/mountinfo") || strcmp(mode,"re")) {
        ++violations;return NULL;
    }
    unsigned id=(scenario==MOUNT_CHANGED && calls[OP_FOPEN]>1) ? 999 : 12;
    const char *type=scenario==BAD_TYPE ? "xfs" : "ext4";
    const char *dev=scenario==OVERFLOW_DEVICE ?
                    "999999999999999999999999999999:17" : "7:17";
    const char *opts=scenario==BAD_OPTIONS ? "rw" : "rw,nosuid,nodev";
    int n=snprintf(text,sizeof(text),
        "11 1 8:16 / /mnt/cashback-r07 rw,nosuid,nodev - ext4 /dev/sdb rw\n");
    if(scenario!=MISSING_MOUNT) {
        n+=snprintf(text+n,sizeof(text)-(size_t)n,
            "%u 11 %s / /mnt/cashback-r07/postgres %s - %s /dev/loop17 rw\n",
            id,dev,opts,type);
    }
    n+=snprintf(text+n,sizeof(text)-(size_t)n,
        "13 11 7:29 / /mnt/cashback-r07/avatars rw,nosuid,nodev - ext4 /dev/loop29 rw\n");
    if(scenario==DUPLICATE_MOUNT)
        n+=snprintf(text+n,sizeof(text)-(size_t)n,
            "14 11 7:17 / /mnt/cashback-r07/postgres rw,nosuid,nodev - ext4 /dev/loop17 rw\n");
    if(scenario==LONG_LINE) {
        memset(text,'x',5000);text[5000]='\n';text[5001]=0;
    }
    if(scenario==MANY_FIELDS) {
        strcpy(text,"1 0 8:1 / /unrelated rw");
        for(int j=0;j<260;j++)strcat(text," x");
        strcat(text," - ext4 /dev/sda rw\n");
    }
    if(scenario==NO_NEWLINE)text[strlen(text)-1]=0;
    return fmemopen(text,strlen(text),"r");
}
static int mock_ferror(FILE *fp) {
    if(fault(OP_FERROR))return 1;
    return ferror(fp);
}
static int mock_fclose(FILE *fp) {
    int broken=fault(OP_FCLOSE);
    int rc=fclose(fp);
    return broken ? EOF : rc;
}
static int failures;
static void run_case(const char *label,int expected_success,const char *expected_reason) {
    memset(calls,0,sizeof(calls));memset(live,0,sizeof(live));violations=0;
    observed_reason=NULL;
    char *args[]={"r07-loop-identity",NULL};
    int rc=helper_main(1,args);
    int leaked=0;
    for(int i=0;i<10;i++)leaked+=live[i];
    int ok=((rc==0)==expected_success) && !violations && !leaked;
    if(!expected_success && !observed_reason)ok=0;
    if(expected_reason && (!observed_reason || strcmp(expected_reason,observed_reason)))ok=0;
    printf("TEST=%s RESULT=%s EXIT=%d\n",label,ok?"PASS":"FAIL",rc);
    if(!ok)++failures;
}
int main(void) {
    int counts[OPS];
    scenario=NORMAL;run_case("positive_dynamic_loop17_loop29",1,NULL);
    memcpy(counts,calls,sizeof(counts));
    for(int op=0;op<OPS;op++)if(counts[op]<=0)++failures;
    static const char *reasons[]={
        NULL,"BACKING_IDENTITY","BACKING_IDENTITY","LOOP_PARAMETERS",
        "LOOP_PARAMETERS","LOOP_PARAMETERS","PATH_PROPERTIES","PATH_OPEN_CLOSE",
        "PATH_PROPERTIES","LOOP_DEVICE","IMAGE_CHANGED","MOUNT_CHANGED",
        "MOUNTINFO_RECORD","MOUNTINFO_RECORD","MOUNTINFO_RECORD","MOUNTINFO_RECORD",
        "MOUNTINFO_RECORD","MOUNTINFO_RECORD","MOUNTINFO_RECORD","MOUNTINFO_RECORD"
    };
    _Static_assert(sizeof(reasons)/sizeof(reasons[0])==BAD_OPTIONS+1,"scenario table");
    for(int s=INODE_BAD;s<=BAD_OPTIONS;s++) {
        char label[64];snprintf(label,sizeof(label),"negative_scenario_%d",s);
        scenario=s;fault_op=-1;run_case(label,0,reasons[s]);
    }
    scenario=NORMAL;
    for(int op=0;op<OPS;op++)for(int nth=1;nth<=counts[op];nth++) {
        char label[64];snprintf(label,sizeof(label),"fault_op_%d_call_%d",op,nth);
        fault_op=op;fault_at=nth;run_case(label,0,NULL);
    }
    fault_op=-1;
    struct stat wide={0};
    struct loop_info64 wide_info={0};
    wide.st_dev=makedev(259,65537);
    wide.st_ino=(ino_t)(UINT64_C(1)<<40);
    wide_info.lo_device=UINT64_C(0x10010301);
    wide_info.lo_inode=(UINT64_C(1)<<40);
    wide_info.lo_number=77;
    if(loop_identity(&wide_info,&wide,77))++failures;
    unsigned long n;
    if(!number("18446744073709551616",ULONG_MAX,&n))++failures;
    if(!number("-1",ULONG_MAX,&n) || !number("+1",ULONG_MAX,&n))++failures;
    char *args[]={"helper","unexpected",NULL};
    if(helper_main(2,args)==0)++failures;
    printf("FAILURE_COUNT=%d\n",failures);
    return failures ? 1 : 0;
}
