interface TDuration {
  from: number;
  to: number;
}

interface Query {
  tag: string;
  duration: TDuration | null;
  eventType: EventSpecType | '';
  text: string;
  filter: string;
}

interface AppLocation {
  hash: string;
  query: Query;
}
