import { Controller, Post, Body, UseGuards, Request, Get, Query, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { ChatGateway } from './chat.gateway';

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('send')
  async sendMessage(
    @Request() req,
    @Body('recipient') recipient: string,
    @Body('content') content: string,
  ) {
    const msg = await this.chatService.sendMessage(req.user.userId, recipient, content);
    this.chatGateway.server.emit('message', msg);
    return msg;
  }

  @Post('group/send')
  async sendGroupMessage(
    @Request() req,
    @Body('groupId') groupId: string,
    @Body('content') content: string,
  ) {
    const msg = await this.chatService.sendGroupMessage(req.user.userId, groupId, content);
    this.chatGateway.server.to(groupId).emit('group-message', msg);
    return msg;
  }

  @Get('messages')
  async getMessages(
    @Request() req,
    @Query('with') withUser: string,
  ) {
    return this.chatService.getMessagesBetweenUsers(req.user.userId, withUser);
  }

  @Get('group/:groupId/messages')
  async getGroupMessages(
    @Param('groupId') groupId: string,
  ) {
    return this.chatService.getGroupMessages(groupId);
  }
}

