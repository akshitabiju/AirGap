export interface DistrictProps {
  id: number
  name: string
  pred: number | null          // predicted daily mean PM2.5 (µg/m³), latest day
  unc: number | null           // 1-sigma uncertainty (µg/m³)
  cams: number | null          // CAMS model baseline for the same day
  pred_prev: number | null     // previous day
  nearest_km: number | null    // distance to nearest ground monitor
  nearest_name: string | null
  pop: number | null           // population of largest city in district (GeoNames), if any
  city: string | null          // name of that city
  urban_pop: number            // sum of GeoNames city populations inside the district
  lat: number
  lon: number
  date: string
}

export interface Station {
  id: number
  name: string
  lat: number
  lon: number
  provider: string | null
  city_group: string
  n_days: number
  last_value?: number | null
  last_date?: string | null
}

export interface FoldMetric { fold: number; n_test: number; n_cities: number; mae: number; rmse: number; r2: number; cams_mae: number; cams_rmse: number; cams_r2: number }
export interface CityMetric { city: string; n: number; mean_obs: number; mean_pred: number; mae: number; cams_mae: number; lat: number; lon: number }
export interface Metrics {
  trained_at: string
  n_train_rows: number
  n_stations: number
  n_city_groups: number
  date_min: string
  date_max: string
  folds: FoldMetric[]
  overall: { mae: number; rmse: number; r2: number; cams_mae: number; cams_rmse: number; cams_r2: number; within_15: number; cams_within_15: number; interval68_coverage: number; median_obs: number; mean_obs: number }
  per_city: CityMetric[]
  scatter: { obs: number; pred: number; cams: number; city: string }[]
  feature_importance: { feature: string; gain: number; share: number }[]
  features: string[]
  model: string
  validation: string
  params: Record<string, unknown>
  seed: number
}

export interface PlacementSite {
  rank: number
  name: string
  lat: number
  lon: number
  pop: number
  district: string | null
  pred: number | null
  unc: number
  nearest_km: number
  score: number
  score_breakdown: { pop_weight: number; unc_weight: number; dist_weight: number; coverage_penalty: number }
  reason: string
}
export interface Placement { generated_at: string; method: string; sites: PlacementSite[]; params: Record<string, unknown> }

export interface Meta {
  generated_at: string
  prediction_date: string
  n_districts: number
  n_stations: number
  ground_truth: Record<string, unknown>
  sources: { name: string; url: string; licence: string; role: string }[]
  districts_no_monitor_50km: number
  urban_pop_over_15: number
  urban_pop_over_60: number
  urban_pop_no_monitor_50km: number
  urban_pop_total: number
  districts_over_15: number
  districts_over_60: number
  district_pred_median: number
}

export interface City { name: string; lat: number; lon: number; pop: number }

/** 92-day predicted history per district: [MM-DD, pred, cams] */
export interface History { start: string; series: Record<string, [string, number, number][]>; forecastFrom?: number }

/** 3-day forecast per district: [MM-DD, pred, lo, hi, cams] */
export interface Forecast { generated_at: string; base_date: string; days: string[]; weather_source: string; series: Record<string, [string, number, number, number, number][]> }

export type ViewMode = 'pred' | 'unc' | 'dist'
