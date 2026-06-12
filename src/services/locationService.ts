// import utils from "../helpers/utils";
import useLocationStore from '@/stores/locationStore';

class LocationService {
  public getState = () => {
    return useLocationStore.getState();
  };

  public clearQuery = () => {
    useLocationStore.getState().setQuery({
      tag: '',
      duration: null,
      text: '',
      eventType: '',
      filter: '',
    });
  };

  public setQuery = (query: Query) => {
    useLocationStore.getState().setQuery(query);
  };

  public setHash = (hash: string) => {
    useLocationStore.getState().setHash(hash);
  };

  public setEventTypeQuery = (eventType: EventSpecType | '' = '') => {
    useLocationStore.getState().setEventType(eventType);
  };

  public setTextQuery = (text: string) => {
    useLocationStore.getState().setText(text);
  };

  public setTagQuery = (tag: string) => {
    useLocationStore.getState().setTagQuery(tag);
  };

  public setFromAndToQuery = (from: number, to: number) => {
    const duration = from && to ? {from, to} : null;
    useLocationStore.getState().setDurationQuery(duration);
  };
}

const locationService = new LocationService();
export default locationService;
