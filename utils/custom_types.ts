
export enum VideoType {
  Stream = 'stream',
  File = 'file',
  Capture = 'capture'
}

export enum StreamType {
  MSE = 'mse',
  Mpegts = 'mpegts',
  M2ts = 'm2ts',
  Flv = 'flv',
  Mp4 = 'mp4'

}

// Define interfaces for each specific video type
export interface StreamVideo {
  type: VideoType.Stream;
  content: String;  // URL of the stream
  streamType?: StreamType;
}

export interface FileVideo {
  type: VideoType.File;
  content: File;  // File object
}

export interface CaptureVideo {
  type: VideoType.Capture;
  content: MediaStream;  // MediaStream object
}

export type Video = StreamVideo | FileVideo | CaptureVideo;
