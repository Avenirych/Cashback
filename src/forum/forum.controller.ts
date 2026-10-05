import { Controller, Post, Get, Param, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { ForumService } from './forum.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('topics')
  async getTopics() {
    console.log('📋 Fetching all topics...');
    return this.forumService.getTopics();
  }

  @Post('topic')
  @UseGuards(JwtAuthGuard)
  async createTopic(
    @Req() req: any,
    @Body('title') title: string,
  ) {
    const userId = req.user.sub;
    console.log('✏️ Creating topic:', { userId, title });
    const topic = await this.forumService.createTopic(userId, title);
    console.log('✅ Topic created:', { id: topic.id, title });
    return topic;
  }

  @Post('post')
  @UseGuards(JwtAuthGuard)
  async createPost(
    @Req() req: any,
    @Body('topicId') topicId: number,
    @Body('content') content: string,
  ) {
    const userId = req.user.sub;
    console.log('✏️ Creating post:', { userId, topicId });
    const post = await this.forumService.createPost(userId, topicId, content);
    console.log('✅ Post created:', { id: post.id });
    return post;
  }

  @Get('topic/:id')
  async getTopic(@Param('id') id: number) {
    console.log('📖 Fetching topic:', id);
    return this.forumService.getTopic(id);
  }

  @Get('posts/:topicId')
  async getPosts(@Param('topicId') topicId: number) {
    console.log('💬 Fetching posts for topic:', topicId);
    return this.forumService.getPosts(topicId);
  }

  @Delete('topic/:id')
  @UseGuards(JwtAuthGuard)
  async deleteTopic(@Req() req: any, @Param('id') id: number) {
    const userId = req.user.sub;
    console.log('🗑️ Deleting topic:', { userId, id });
    await this.forumService.deleteTopic(id, userId);
    console.log('✅ Topic deleted:', id);
    return { success: true };
  }
}
