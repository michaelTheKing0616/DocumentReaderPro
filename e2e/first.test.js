describe('ReadAssist Pro', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('launches the app', async () => {
    await expect(device).toBeDefined();
  });

  it('shows library screen and navigates via tab bar', async () => {
    await waitFor(element(by.id('library-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('tab-library')).tap();
    await expect(element(by.id('library-screen'))).toBeVisible();
  });
});
