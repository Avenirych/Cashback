import {
Body,
Controller,
Delete,
Get,
Param,
Patch,
Post,
} from '@nestjs/common';
 
import { PostsService } from './posts.service';
 
@Controller('posts')
export class PostsController {
constructor(
private readonly postsService: PostsService,
) {}
 
@Get('topic/:id')
findByTopic(
@Param('id') id: string,
) {
return this.postsService.findByTopic(
Number(id),
);
}
 
@Post()
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
 
@Patch(':id')
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
 
@Delete(':id')
remove(
@Param('id') id: string,
) {
return this.postsService.remove(
Number(id),
);
}
}