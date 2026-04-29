const axios = require('axios');
const { sendSMS } = require('../src/services/sevenio');
const { validatePhoneNumber } = require('../src/utils/validation');

jest.mock('axios');

describe('German phone number normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SEVEN_IO_API_KEY = 'test-api-key';
  });

  test('formats local mobile numbers as +49 before validation returns success', () => {
    expect(validatePhoneNumber('01604947119')).toMatchObject({
      isValid: true,
      formatted: '+491604947119',
      national: '01604947119'
    });
  });

  test('accepts numeric mobile numbers when the leading zero was dropped', () => {
    expect(validatePhoneNumber(1604947119)).toMatchObject({
      isValid: true,
      formatted: '+491604947119',
      national: '01604947119'
    });
  });

  test('sends normalized +49 phone numbers to seven.io', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        total_price: 0.075,
        messages: [{ id: 'sms-123', parts: 1 }]
      }
    });

    await expect(sendSMS('01604947119', 'Test message')).resolves.toMatchObject({
      success: true,
      messageId: 'sms-123'
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://gateway.seven.io/api/sms',
      expect.objectContaining({
        to: '+491604947119',
        text: 'Test message'
      }),
      expect.any(Object)
    );
  });
});
