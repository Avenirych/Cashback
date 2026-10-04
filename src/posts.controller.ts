import {
  Body,
  Controller,
  Get,
  Param,
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
}