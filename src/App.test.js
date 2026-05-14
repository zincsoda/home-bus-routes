import { render, screen, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import App from './App';

const axiosMock = jest.requireMock('axios').default;

function mockEtaResponses() {
  axiosMock.get.mockImplementation((url) => {
    if (typeof url !== 'string' || !url.includes('/eta/')) {
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }
    return Promise.resolve({ status: 200, data: { data: [] } });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEtaResponses();
});

test('shows bus signage after ETAs finish loading', async () => {
  render(<App />);
  expect(screen.getByText(/loading bus routes/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText(/loading bus routes/i)).not.toBeInTheDocument();
  });

  expect(screen.getByText(/current time/i)).toBeInTheDocument();
});

test('signage shell uses dark green background', async () => {
  const { container } = render(<App />);

  await waitFor(() => {
    expect(screen.queryByText(/loading bus routes/i)).not.toBeInTheDocument();
  });

  const signage = container.querySelector('.signage-container');
  expect(signage).toBeTruthy();

  expect(signage).toHaveStyle({
    backgroundImage:
      'linear-gradient(135deg, rgb(10, 40, 24) 0%, rgb(22, 76, 47) 100%)',
  });
});
