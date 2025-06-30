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












import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(userId); // Join a room named after the user ID
    }
  }

  @SubscribeMessage('private-message')
  async handlePrivateMessage(
    @MessageBody() data: { sender: string; recipient: string; content: string }
  ) {
    const savedMessage = await this.chatService.sendMessage(data.sender, data.recipient, data.content);
    const populatedMessage = await savedMessage.populate('sender', 'username');
    void this.server.to(data.sender).to(data.recipient).emit('private-message', populatedMessage.toObject());
  }

  @SubscribeMessage('group-message')
  async handleGroupMessage(
    @MessageBody() data: { sender: string; groupId: string; content: string }
  ) {
    const savedMessage = await this.chatService.sendGroupMessage(data.sender, data.groupId, data.content);
    const populatedMessage = await savedMessage.populate('sender', 'username');
    void this.server.to(data.groupId).emit('group-message', populatedMessage.toObject());
  }

  @SubscribeMessage('join-group')
  handleJoinGroup(
    @MessageBody() data: { userId: string; groupId: string }
  ) {
    void this.server.to(data.groupId).emit('user-joined-group', { userId: data.userId, groupId: data.groupId });
  }

  @SubscribeMessage('leave-group')
  handleLeaveGroup(
    @MessageBody() data: { userId: string; groupId: string }
  ) {
    void this.server.to(data.groupId).emit('user-left-group', { userId: data.userId, groupId: data.groupId });
  }
}
