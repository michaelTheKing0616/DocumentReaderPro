/** Web shim — mDNS discovery is native-only. */
class ZeroconfStub {
  async scan(_type: string): Promise<Array<{ name: string; host: string; port: number }>> {
    return [];
  }
  stop(): void {}
}

export default ZeroconfStub;
