import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ForumService } from './forum.service';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('topics')
  getTopics() {
    return this.forumService.getTopics();
  }

  @Post('topic')
  createTopic(
    @Body('userId') userId: number,
    @Body('title') title: string,
  ) {
    return this.forumService.createTopic(userId, title);
  }

  @Post('post')
  createPost(
    @Body('userId') userId: number,
    @Body('topicId') topicId: number,
    @Body('content') content: string,
  ) {
    return this.forumService.createPost(userId, topicId, content);
  }

  @Get('topic/:id')
  getTopic(@Param('id') id: number) {
    return this.forumService.getTopic(id);
  }

  @Get('posts/:topicId')
  getPosts(@Param('topicId') topicId: number) {
    return this.forumService.getPosts(topicId);
  }
}
