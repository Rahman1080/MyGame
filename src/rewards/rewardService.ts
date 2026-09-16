export interface AdService {
  showInterstitial(): Promise<void>;
  showRewardedHint(): Promise<boolean>;
  showRewardedRetry(): Promise<boolean>;
}

export const noopAds: AdService = {
  async showInterstitial() {},
  async showRewardedHint() {
    return false;
  },
  async showRewardedRetry() {
    return false;
  },
};
