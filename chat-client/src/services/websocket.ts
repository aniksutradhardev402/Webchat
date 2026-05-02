export type WebSocketEvent = 'new_message' | 'status_update' | 'typing' | 'presence';

type MessageHandler = (data: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private isConnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private handlers: Map<WebSocketEvent, Set<MessageHandler>> = new Map();

  constructor(token: string) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002';
    this.url = `${wsUrl}/ws?token=${token}`;
    this.token = token;
  }

  public connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket Connected');
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.action as WebSocketEvent, data);
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket Disconnected. Reconnecting...');
        this.ws = null;
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
    } catch (e) {
      console.error('WebSocket Exception:', e);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect looping
      this.ws.close();
      this.ws = null;
    }
  }

  public send(action: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, data }));
    } else {
      console.warn("WebSocket is not connected. Msg not sent.");
    }
  }

  public on(event: WebSocketEvent, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  public off(event: WebSocketEvent, handler: MessageHandler) {
    if (this.handlers.has(event)) {
      this.handlers.get(event)!.delete(handler);
    }
  }

  private emit(event: WebSocketEvent, data: any) {
    if (this.handlers.has(event)) {
      this.handlers.get(event)!.forEach((h) => h(data));
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }
}
