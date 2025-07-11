// import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { ChatService } from './chat.service';
// import { Injectable } from '@nestjs/common';

// @WebSocketGateway({ cors: { origin: '*' } })
// @Injectable()
// export class ChatGateway implements OnGatewayConnection {
//   @WebSocketServer()
//   server: Server;

//   constructor(private readonly chatService: ChatService) {}

//   handleConnection(client: Socket) {
//     const userId = client.handshake.query.userId as string;
//     if (userId) {
//       client.join(userId); // Join a room named after the user ID
//     }
//   }

//   @SubscribeMessage('private-message')
//   async handlePrivateMessage(
//     @MessageBody() data: { sender: string; recipient: string; content: string },
//     @ConnectedSocket() client: Socket
//   ) {
//     // Save the message to the database
//     const savedMessage = await this.chatService.sendMessage(data.sender, data.recipient, data.content);
//     // Populate the sender field
//     const populatedMessage = await savedMessage.populate('sender', 'username');
//     // Emit the message to both sender and recipient rooms
//     // this.server.to(data.sender).to(data.recipient).emit('private-message', populatedMessage.toObject());
//     void this.server.to(data.sender).to(data.recipient).emit('private-message', populatedMessage.toObject());
//   }

//   @SubscribeMessage('group-message')
//   async handleGroupMessage(
//     @MessageBody() data: { sender: string; groupId: string; content: string },
//     @ConnectedSocket() client: Socket
//   ) {
//     // Save the message to the database
//     const savedMessage = await this.chatService.sendGroupMessage(data.sender, data.groupId, data.content);
//     // Populate the sender field
//     const populatedMessage = await savedMessage.populate('sender', 'username');
//     // Emit the message to the group room
//     // this.server.to(data.groupId).emit('group-message', populatedMessage.toObject());
//     void this.server.to(data.groupId).emit('group-message', populatedMessage.toObject());
//   }

//   @SubscribeMessage('join-group')
//   async handleJoinGroup(
//     // @MessageBody() data: { userId: string; groupId: string },
//     // @ConnectedSocket() client: Socket
//     @MessageBody() data: { userId: string; groupId: string }
//   ) {
//     // client.join(data.groupId);
//     // this.server.to(data.groupId).emit('user-joined-group', { userId: data.userId, groupId: data.groupId });
//     // No need for client param
//     // Join the group room
//     // this.server.socketsJoin(data.groupId); // Not needed, handled by client.join
//     void this.server.to(data.groupId).emit('user-joined-group', { userId: data.userId, groupId: data.groupId });
//   }

//   @SubscribeMessage('leave-group')
//   async handleLeaveGroup(
//     // @MessageBody() data: { userId: string; groupId: string },
//     // @ConnectedSocket() client: Socket
//     @MessageBody() data: { userId: string; groupId: string }
//   ) {
//     // client.leave(data.groupId);
//     // this.server.to(data.groupId).emit('user-left-group', { userId: data.userId, groupId: data.groupId });
//     // No need for client param
//     void this.server.to(data.groupId).emit('user-left-group', { userId: data.userId, groupId: data.groupId });
//   }
// } 












import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, OnGatewayConnection, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './message.schema';

// --- User Presence Tracking ---
const onlineUsers: Map<string, Set<string>> = new Map();

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    console.log('Socket connected for userId:', userId);
    if (userId) {
      client.join(userId);
      // --- Presence logic ---
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
        this.server.emit('user-online', userId); // Broadcast online
      }
      onlineUsers.get(userId)!.add(client.id);
    }
  }

  handleDisconnect(client: Socket) {
    // --- Presence logic ---
    for (const [userId, sockets] of onlineUsers.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          this.server.emit('user-offline', userId); // Broadcast offline
        }
        break;
      }
    }
  }

  // Utility to get all online user IDs
  getOnlineUsers(): string[] {
    return Array.from(onlineUsers.keys());
  }

  @SubscribeMessage('private-message')
  async handlePrivateMessage(
    @MessageBody() data: { sender: string; recipient: string; content: string; replyTo?: string }
  ) {
    const savedMessage = await this.chatService.sendMessage(data.sender, data.recipient, data.content, undefined, data.replyTo);
    const populatedMessage = await savedMessage.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    void this.server.to(data.sender).to(data.recipient).emit('private-message', populatedMessage.toObject());
    console.log('Emitting to sender:', data.sender, 'and recipient:', data.recipient);
  }

  @SubscribeMessage('group-message')
  async handleGroupMessage(
    @MessageBody() data: { sender: string; groupId: string; content: string; replyTo?: string }
  ) {
    const savedMessage = await this.chatService.sendGroupMessage(data.sender, data.groupId, data.content, undefined, data.replyTo);
    const populatedMessage = await savedMessage.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    void this.server.to(data.groupId).emit('group-message', populatedMessage.toObject());
  }

  // @SubscribeMessage('join-group')
  // handleJoinGroup(
  //   @MessageBody() data: { userId: string; groupId: string }
  // ) {
  //   void this.server.to(data.groupId).emit('user-joined-group', { userId: data.userId, groupId: data.groupId });
  // }

  @SubscribeMessage('join-group')
handleJoinGroup(
  @MessageBody() data: { userId: string; groupId: string },
  @ConnectedSocket() client: Socket
) {
  client.join(data.groupId); // <-- This is required!
  void this.server.to(data.groupId).emit('user-joined-group', { userId: data.userId, groupId: data.groupId });
}

  @SubscribeMessage('leave-group')
  handleLeaveGroup(
    @MessageBody() data: { userId: string; groupId: string }
  ) {
    void this.server.to(data.groupId).emit('user-left-group', { userId: data.userId, groupId: data.groupId });
  }

  @SubscribeMessage('typing')
handleTyping(
  @MessageBody() data: { sender: string; recipient?: string; groupId?: string; isGroup?: boolean },
  @ConnectedSocket() client: Socket
) {
  if (data.isGroup && data.groupId) {
    // Broadcast to group except sender
    client.to(data.groupId).emit('typing', { sender: data.sender, groupId: data.groupId });
  } else if (data.recipient) {
    // Broadcast to recipient only
    this.server.to(data.recipient).emit('typing', { sender: data.sender });
  }
}

@SubscribeMessage('message-delivered')
async handleMessageDelivered(
  @MessageBody() data: { messageId: string, senderId: string }
) {
  await this.messageModel.findByIdAndUpdate(data.messageId, { status: 'delivered' });
  this.server.to(data.senderId).emit('message-delivered', { messageId: data.messageId });
}

@SubscribeMessage('message-read')
async handleMessageRead(
  @MessageBody() data: { messageId: string, senderId: string }
) {
  await this.messageModel.findByIdAndUpdate(data.messageId, { status: 'read' });
  this.server.to(data.senderId).emit('message-read', { messageId: data.messageId });
}
}
