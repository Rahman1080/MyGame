import type { AdsService, InterstitialAd, RewardedAd } from "../../types";

const noReward: RewardedAd = {
  async show(): Promise<boolean> {
    return false;
  },
};

const noInterstitial: InterstitialAd = {
  async show(): Promise<void> {
    /* ads disabled in M1 */
  },
};

/** M1: ads are interfaces only. No SDK, no permissions. */
export class NoopAdsService implements AdsService {
  enabled = false;
  rewarded(): RewardedAd {
    return noReward;
  }
  interstitial(): InterstitialAd {
    return noInterstitial;
  }
}
