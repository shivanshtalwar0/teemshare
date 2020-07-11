
export 	enum DebugLevel {
  Trace = 'trace',
  Debug = 'debug',
  Log = 'log',
  Warning = 'warn',
  Error = 'error'
}

export interface JSEP {}
export  interface Dependencies {
  adapter: any;
  newWebSocket: (server: string, protocol: string) => WebSocket;
  isArray: (array: any) => array is Array<any>;
  checkJanusExtension: () => boolean;
  httpAPICall: (url: string, options: any) => void;
}


export  interface InitOptions {
  debug?: boolean | 'all' | DebugLevel[];
  callback?: Function;
  dependencies?: Dependencies;
}

export  	interface ConstructorOptions {
  server: string | string[];
  iceServers?: RTCIceServer[];
  ipv6?: boolean;
  withCredentials?: boolean;
  max_poll_events?: number;
  destroyOnUnload?: boolean;
  token?: string;
  apisecret?: string;
  success?: Function;
  error?: (error: any) => void;
  destroyed?: Function;
}
export  	interface PluginOptions {
  plugin: string;
  opaqueId?: string;
  success?: (handle: PluginHandle) => void;
  error?: (error: any) => void;
  consentDialog?: (on: boolean) => void;
  webrtcState?: (isConnected: boolean) => void;
  iceState?: (state: 'connected' | 'failed') => void;
  mediaState?: (state: { type: 'audio' | 'video'; on: boolean }) => void;
  slowLink?: (state: { uplink: boolean }) => void;
  onmessage?: (message: Message, jsep?: JSEP) => void;
  onlocalstream?: (stream: MediaStream) => void;
  onremotestream?: (stream: MediaStream) => void;
  ondataopen?: Function;
  ondata?: Function;
  oncleanup?: Function;
  detached?: Function;
}

export  	interface OfferParams {
  media?: {
    audioSend?: boolean;
    audioRecv?: boolean;
    videoSend?: boolean;
    videoRecv?: boolean;
    audio?: boolean | { deviceId: string };
    video?:
      | boolean
      | { deviceId: string }
      | 'lowres'
      | 'lowres-16:9'
      | 'stdres'
      | 'stdres-16:9'
      | 'hires'
      | 'hires-16:9';
    data?: boolean;
    failIfNoAudio?: boolean;
    failIfNoVideo?: boolean;
    screenshareFrameRate?: number;
  };
  trickle?: boolean;
  stream?: MediaStream;
  success: Function;
  error: (error: any) => void;
}

export  interface PluginMessage {
  message: {
    request: string;
    [otherProps: string]: any;
  };
  jsep?: JSEP;
}

export  interface PluginHandle {
  getId(): string;
  getPlugin(): string;
  send(message: PluginMessage): void;
  createOffer(params: any): void;
  createAnswer(params: any): void;
  handleRemoteJsep(params: { jsep: JSEP }): void;
  dtmf(params: any): void;
  data(params: any): void;
  isVideoMuted(): boolean;
  muteVideo(): void;
  unmuteVideo(): void;
  getBitrate(): number;
  hangup(sendRequest?: boolean): void;
  detach(params: any): void;
}

export interface  Janus {
  useDefaultDependencies(deps: Partial<Dependencies>): Dependencies;
  useOldDependencies(deps: Partial<Dependencies>): Dependencies;
   init(options: InitOptions): void;
  isWebrtcSupported(): boolean;
   debug(...args: any[]): void;
   log(...args: any[]): void;
  warn(...args: any[]): void;
   error(...args: any[]): void;
   randomString(length: number): string;
  attachMediaStream(element: HTMLMediaElement, stream: MediaStream): void;
   reattachMediaStream(to: HTMLMediaElement, from: HTMLMediaElement): void;

  constructor(options: ConstructorOptions);

  getServer(): string;
  isConnected(): boolean;
  getSessionId(): string;
  attach(options: PluginOptions): void;
  destroy(): void;
}

export enum MessageType {
  Recording = 'recording',
  Starting = 'starting',
  Started = 'started',
  Stopped = 'stopped',
  SlowLink = 'slow_link',
  Preparing = 'preparing',
  Refreshing = 'refreshing'
}
export interface Message {
  result?: {
    status: MessageType;
    id?: string;
    uplink?: number;
  };
  error?: Error;
}

