import { Controller, Post, Get, Param, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { ForumService } from './forum.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('topics')
  async getTopics() {
    return this.forumService.getTopics();
  }

  @Post('topic')
  @UseGuards(JwtAuthGuard)
  async createTopic(@Req() req: any, @Body('title') title: string) {
    // JwtStrategy.validate returns { id, email }
    const userId = req.user.id;
    console.log('Creating topic:', { userId, title });
    return this.forumService.createTopic(userId, title);
  }

  @Post('post')
  @UseGuards(JwtAuthGuard)
  async createPost(
    @Req() req: any,
    @Body('topicId') topicId: number,
    @Body('content') content: string,
  ) {
    const userId = req.user.id;
    return this.forumService.createPost(userId, Number(topicId), content);
  }

  @Get('topic/:id')
  async getTopic(@Param('id') id: string) {
    return this.forumService.getTopic(Number(id));
  }

  @Get('posts/:topicId')
  async getPosts(@Param('topicId') topicId: string) {
    return this.forumService.getPosts(Number(topicId));
  }

  @Delete('topic/:id')
  @UseGuards(JwtAuthGuard)
  async deleteTopic(@Req() req: any, @Param('id') id: string) {
    await this.forumService.deleteTopic(Number(id), req.user.id);
    return { success: true };
  }
}
