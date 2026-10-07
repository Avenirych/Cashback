import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Delete,
  Patch,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ForumService } from './forum.service';
import { AVATAR_MAX_SIZE, ForumUserService } from './forum-user.service';
import type { AvatarUpload } from './forum-user.service';
import { FORUM_RULES } from './forum-rules';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface ForumRequest {
  user: { id: number };
}

@Controller('forum')
export class ForumController {
  constructor(
    private readonly forumService: ForumService,
    private readonly forumUserService: ForumUserService,
  ) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  register(
    @Req() req: ForumRequest,
    @Body('username') username: unknown,
    @Body('agreedToRules') agreedToRules: unknown,
  ) {
    return this.forumUserService.register(req.user.id, username, agreedToRules);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@Req() req: ForumRequest) {
    return this.forumUserService.status(req.user.id);
  }

  @Get('rules')
  rules() {
    return FORUM_RULES;
  }

  @Get('user/:username')
  publicProfile(@Param('username') username: string) {
    return this.forumUserService.publicProfile(username);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() req: ForumRequest, @Body() body: unknown) {
    return this.forumUserService.updateProfile(req.user.id, body);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_MAX_SIZE, files: 1 },
    }),
  )
  uploadAvatar(
    @Req() req: ForumRequest,
    @UploadedFile() file: AvatarUpload | undefined,
  ) {
    return this.forumUserService.uploadAvatar(req.user.id, file);
  }

  @Get('topics')
  @UseGuards(JwtAuthGuard)
  async getTopics(@Req() req: ForumRequest) {
    await this.forumUserService.assertVerifiedUser(req.user.id);
    return this.forumService.getTopics();
  }

  @Post('topic')
  @UseGuards(JwtAuthGuard)
  createTopic(@Req() req: ForumRequest, @Body('title') title: unknown) {
    return this.forumService.createTopic(req.user.id, title);
  }

  @Post('post')
  @UseGuards(JwtAuthGuard)
  createPost(
    @Req() req: ForumRequest,
    @Body('topicId', ParseIntPipe) topicId: number,
    @Body('content') content: unknown,
  ) {
    return this.forumService.createPost(req.user.id, topicId, content);
  }

  @Get('topic/:id')
  @UseGuards(JwtAuthGuard)
  async getTopic(
    @Req() req: ForumRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.forumUserService.assertVerifiedUser(req.user.id);
    return this.forumService.getTopic(id);
  }

  @Get('posts/:topicId')
  @UseGuards(JwtAuthGuard)
  async getPosts(
    @Req() req: ForumRequest,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    await this.forumUserService.assertVerifiedUser(req.user.id);
    return this.forumService.getPosts(topicId);
  }

  @Delete('topic/:id')
  @UseGuards(JwtAuthGuard)
  async deleteTopic(
    @Req() req: ForumRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.forumService.deleteTopic(id, req.user.id);
    return { success: true };
  }
}
