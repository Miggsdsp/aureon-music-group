'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { trackAnalytics } from '@/lib/track-analytics';

export default function WebVitalsReporter() {
  useReportWebVitals(metric => {
    trackAnalytics({
      eventType: 'core_web_vital',
      metricName: metric.name,
      metricValue: metric.value,
      metricRating: metric.rating,
      metricId: metric.id,
    });
  });

  return null;
}
