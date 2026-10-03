import { Controller, Post, Body } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() body: { topicId: number; content: string; authorId: number }) {
    return this.postsService.create(body);
  }
}
