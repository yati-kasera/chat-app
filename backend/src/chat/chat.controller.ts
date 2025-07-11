import { Controller, Post, Body, UseGuards, Request, Get, Query, Param, UploadedFile, UseInterceptors, Patch, Delete } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { ChatGateway } from './chat.gateway';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { getLinkPreview } from 'link-preview-js';
import { BadRequestException } from '@nestjs/common';

interface JwtUserReq {
  user: { userId: string; email: string; username: string };
}

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('send')
  async sendMessage(
    @Request() req: JwtUserReq,
    @Body('recipient') recipient: string,
    @Body('content') content: string,
    @Body('replyTo') replyTo?: string,
  ) {
    const msg = await this.chatService.sendMessage(req.user.userId, recipient, content, undefined, replyTo);
    const populatedMsg = await msg.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    this.chatGateway.server.emit('message', populatedMsg);
    return populatedMsg;
  }

  @Post('send-file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
      }
    })
  }))
  async sendUserFileMessage(
    @Request() req: JwtUserReq,
    @UploadedFile() file: Express.Multer.File,
    @Body('recipient') recipient: string,
    @Body('content') content: string,
    @Body('replyTo') replyTo?: string,
  ) {
    const msg = await this.chatService.sendMessage(req.user.userId, recipient, content, file, replyTo);
    const populatedMsg = await msg.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    this.chatGateway.server.emit('message', populatedMsg);
    return populatedMsg;
  }

  @Post('group/send')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
      }
    })
  }))
  async sendGroupMessage(
    @Request() req: JwtUserReq,
    @UploadedFile() file: Express.Multer.File,
    @Body('groupId') groupId: string,
    @Body('content') content: string,
    @Body('replyTo') replyTo?: string,
  ) {
    const msg = await this.chatService.sendGroupMessage(req.user.userId, groupId, content, file, replyTo);
    const populatedMsg = await msg.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    this.chatGateway.server.to(groupId).emit('group-message', populatedMsg);
    return populatedMsg;
  }

  @Get('messages')
  async getMessages(
    @Request() req: JwtUserReq,
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

  @Get('link-preview')
  async getLinkPreview(@Query('url') url: string): Promise<any> {
    if (!url) throw new BadRequestException('No URL provided');
    return getLinkPreview(url);
  }

  @Patch('message/:id')
  async editMessage(
    @Request() req: JwtUserReq,
    @Param('id') messageId: string,
    @Body('content') content: string,
  ) {
    const msg = await this.chatService.editMessage(messageId, req.user.userId, content);
    this.chatGateway.server.emit('message-edited', msg);
    return msg;
  }

  @Delete('message/:id')
  async deleteMessage(
    @Request() req: JwtUserReq,
    @Param('id') messageId: string,
  ) {
    const msg = await this.chatService.deleteMessage(messageId, req.user.userId);
    this.chatGateway.server.emit('message-deleted', msg);
    return msg;
  }

  @Patch('group/message/:id')
  async editGroupMessage(
    @Request() req: JwtUserReq,
    @Param('id') messageId: string,
    @Body('groupId') groupId: string,
    @Body('content') content: string,
  ) {
    const msg = await this.chatService.editGroupMessage(messageId, req.user.userId, content);
    this.chatGateway.server.to(groupId).emit('group-message-edited', msg);
    return msg;
  }

  @Delete('group/message/:id')
  async deleteGroupMessage(
    @Request() req: JwtUserReq,
    @Param('id') messageId: string,
    @Body('groupId') groupId: string,
  ) {
    const msg = await this.chatService.deleteGroupMessage(messageId, req.user.userId);
    this.chatGateway.server.to(groupId).emit('group-message-deleted', msg);
    return msg;
  }

  @Post('message/:id/reaction')
  async toggleReaction(
    @Request() req: JwtUserReq,
    @Param('id') messageId: string,
    @Body('emoji') emoji: string,
  ) {
    const msg = await this.chatService.toggleReaction(messageId, req.user.userId, emoji);
    this.chatGateway.server.emit('message-reaction', msg);
    return msg;
  }
}

