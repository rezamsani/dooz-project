import { TestBed } from '@angular/core/testing';
import { NATIVE_TWELVE_BILLING, TwelveBilling, TwelveStoreStatus } from './twelve-billing';

const native = {
  getStatus: vi.fn<() => Promise<TwelveStoreStatus>>(),
  getOffer: vi.fn<() => Promise<TwelveStoreStatus>>(),
  purchase: vi.fn<() => Promise<TwelveStoreStatus>>(),
  restore: vi.fn<() => Promise<TwelveStoreStatus>>(),
};

describe('12-piece store billing', () => {
  const locked = { store: 'myket', configured: true, owned: false } as const;
  const owned = { ...locked, owned: true };

  beforeEach(() => {
    vi.resetAllMocks();
    native.getStatus.mockResolvedValue(locked);
    TestBed.configureTestingModule({ providers: [{ provide: NATIVE_TWELVE_BILLING, useValue: native }] });
  });

  it('does not unlock a canceled purchase and unlocks a restored purchase', async () => {
    native.purchase.mockRejectedValue({ code: 'CANCELED' });
    native.restore.mockResolvedValue(owned);
    const billing = TestBed.inject(TwelveBilling);
    await billing.ready;
    expect(billing.canPlay()).toBe(false);
    await billing.purchase();
    expect(billing.message()).toBe('خرید لغو شد.');
    expect(billing.canPlay()).toBe(false);
    await billing.restore();
    expect(billing.canPlay()).toBe(true);
  });

  it('keeps a verified cached entitlement when the store is unreachable', async () => {
    native.getStatus.mockResolvedValue(owned);
    native.restore.mockRejectedValue(new Error('offline'));
    const billing = TestBed.inject(TwelveBilling);
    await billing.ready;
    await vi.waitFor(() => expect(billing.busy()).toBeNull());
    expect(native.restore).toHaveBeenCalledOnce();
    expect(billing.canPlay()).toBe(true);
  });

  it('requires the store edition for web users without contacting Android billing', async () => {
    TestBed.overrideProvider(NATIVE_TWELVE_BILLING, { useValue: null });
    const billing = TestBed.inject(TwelveBilling);
    await billing.ready;
    expect(billing.canPlay()).toBe(false);
    expect(billing.storefrontRequired()).toBe(true);
    expect(native.getStatus).not.toHaveBeenCalled();
  });
});
