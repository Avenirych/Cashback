import {
Body,
Controller,
Param,
} from '@nestjs/common';
 
import { PostsService } from './posts.service';
 
// Legacy HTTP handlers are unregistered pending an approved authorization model.
@Controller('posts')
export class PostsController {
constructor(
private readonly postsService: PostsService,
) {}
findByTopic(
@Param('id') id: string,
) {
return this.postsService.findByTopic(
Number(id),
);
}
create(
@Body()
body: {
topicId: number;
content: string;
},
) {
return this.postsService.create(
body.topicId,
body.content,
);
}
update(
@Param('id') id: string,
@Body()
body: {
content: string;
},
) {
return this.postsService.update(
Number(id),
body.content,
);
}
remove(
@Param('id') id: string,
) {
return this.postsService.remove(
Number(id),
);
}
}
