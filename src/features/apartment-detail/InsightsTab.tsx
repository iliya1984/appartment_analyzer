import { m2, kindLabel } from '@/domain/format';
import { gaugePosition, getInsights, outdoorName } from '@/domain/insights';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import { Fact, Facts, Kpi, Kpis, Section } from '@/shared/ui/Content';
import { useDataset } from '@/store/selectors';
import styles from './InsightsTab.module.css';
import { getGaugeLabels, getKpis } from './kpis';

const T = he.insightsTab;

export function PriceGauge({ apartment: a }: { apartment: Apartment }) {
  const labels = getGaugeLabels(a);
  if (!labels || !a.comparison) return null;
  return (
    <Section title={T.gaugeTitle(a.comparison.label)}>
      <div className={styles.gauge} aria-hidden="true">
        <i className={styles.marker} style={{ insetInlineStart: `${gaugePosition(a)}%` }} />
      </div>
      <div className={`${styles.gaugeLabels} num`}>
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </Section>
  );
}

export function InsightsTab({ apartment: a }: { apartment: Apartment }) {
  const dataset = useDataset();
  const insights = getInsights(a, dataset);
  return (
    <>
      <Kpis>
        {getKpis(a).map(([label, value]) => (
          <Kpi key={label} label={label} value={value} />
        ))}
      </Kpis>
      <PriceGauge apartment={a} />
      <Section title={T.whatToKnow}>
        <ul className={styles.insights}>
          {insights.map((i) => (
            <li
              key={i.id}
              className={cx(styles.item, i.tone !== 'neutral' && styles[i.tone])}
              data-tone={i.tone}
            >
              <span className={styles.icon} aria-hidden="true">
                {i.icon}
              </span>
              <div>
                <h4>{i.title}</h4>
                <p>{i.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={T.details}>
        <Facts>
          <Fact label={T.factPlan} value={a.planType} />
          <Fact label={T.factSale} value={a.saleType} />
          <Fact label={T.factKind} value={kindLabel(a.kind)} />
          <Fact label={T.factArea} value={`${m2(a.area)} מ״ר`} />
          <Fact label={outdoorName(a)} value={`${m2(a.outdoor)} מ״ר`} />
          <Fact label={T.factStorage} value={`${m2(a.storage.area)} מ״ר`} />
        </Facts>
      </Section>
    </>
  );
}
