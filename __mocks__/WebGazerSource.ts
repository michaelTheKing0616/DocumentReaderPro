export default {
  create: () => ({
    start: jest.fn(),
    stop: jest.fn(),
    isActive: jest.fn(() => false),
    setCallback: jest.fn(),
  }),
};
