declare module 'react-big-calendar/lib/utils/layout-algorithms/no-overlap' {
  const noOverlapModule: unknown;
  export default noOverlapModule;
}

declare module 'react-big-calendar/lib/Month' {
  import {Component} from 'react';
  type MonthViewProps = Record<string, unknown>;
  type MonthViewState = Record<string, unknown>;
  class MonthView extends Component<MonthViewProps, MonthViewState> {
    state: MonthViewState;
    measureRowLimit(): void;
  }
  export default MonthView;
}
