import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly notifications: NotificationsService) {}

  afterInit(server: Server) {
    this.notifications.bindServer(server);
    this.logger.log('Realtime notification gateway initialized');
  }

  handleConnection(client: Socket) {
    client.emit('realtime.connected', { connected: true });
  }
}
