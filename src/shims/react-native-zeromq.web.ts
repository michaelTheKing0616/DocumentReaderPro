/** Web shim — Pupil Labs ZMQ is native-only. */
const ZeroMqStub = {
  Subscriber: class {
    connect(_address: string): void {
      throw new Error('react-native-zeromq is not available on web');
    }
    subscribe(_topic: string): void {}
    onMessage(_handler: (topic: string, payload: Buffer | string) => void): void {}
    close(): void {}
  },
};

export default ZeroMqStub;
