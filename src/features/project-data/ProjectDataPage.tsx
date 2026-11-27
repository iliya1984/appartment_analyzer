import { floorLabel, fmt, m2 } from '@/domain/format';
import { he } from '@/i18n/he';
import { ListHead, Section, TableScroll, tableClasses } from '@/shared/ui/Content';
import { useDatasetStore } from '@/store/datasetStore';
import { useDataset } from '@/store/selectors';
import { WorkbookUpload } from './WorkbookUpload';

const T = he.data;

function SourceInfo() {
  const dataset = useDataset();
  const source = useDatasetStore((s) => s.source);
  const { meta } = dataset;
  return (
    <p className="muted">
      {source.kind === 'built-in'
        ? T.builtIn(meta.file, meta.dev, meta.lottery, fmt(meta.base))
        : T.loaded(source.fileName, dataset.apartments.length)}
    </p>
  );
}

function BuildingsTable() {
  const dataset = useDataset();
  const n = tableClasses.n;
  return (
    <TableScroll>
      <table className={tableClasses.table}>
        <thead>
          <tr>
            <th>{T.colBuilding}</th>
            <th>{T.colPlot}</th>
            <th>{T.colUnits}</th>
            <th>{T.colFloors}</th>
            <th>{T.colTarget}</th>
            <th>{T.colAvgArea}</th>
            <th>{T.colPriceRange}</th>
          </tr>
        </thead>
        <tbody>
          {dataset.buildings.map((b) => {
            const s = dataset.buildingStats.get(b);
            if (!s) return null;
            return (
              <tr key={b}>
                <td>
                  <b>{b}</b>
                </td>
                <td className={n}>{s.plot}</td>
                <td className={n}>{s.units}</td>
                <td className={n}>
                  {T.floorsRange(floorLabel(s.floorMin), floorLabel(s.floorMax))}
                </td>
                <td className={n}>{s.targetUnits}</td>
                <td className={n}>{m2(s.avgArea)}</td>
                <td className={n}>
                  {s.priceMin && s.priceMax != null
                    ? T.priceRange(fmt(s.priceMin), fmt(s.priceMax))
                    : he.common.dash}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** Data source, workbook upload and a per-building summary. */
export function ProjectDataPage() {
  return (
    <main>
      <ListHead>
        <h2>{T.title}</h2>
      </ListHead>
      <Section title={T.source}>
        <SourceInfo />
        <WorkbookUpload />
      </Section>
      <Section title={T.summary}>
        <BuildingsTable />
      </Section>
    </main>
  );
}
