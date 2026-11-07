/** Art direction for the fictional catalog, independent of watch specs and prices. */
export type WatchProfile = readonly [
  caseShape: 'round' | 'square' | 'tank' | 'octagon' | 'triangle' | 'barrel',
  metal: 'steel' | 'gold' | 'rose' | 'black' | 'titanium',
  dial: string,
  band: 'links' | 'fine-links' | 'leather' | 'rubber' | 'fabric' | 'gems',
  face:
    | 'plain'
    | 'date'
    | 'day-date'
    | 'dive'
    | 'gmt'
    | 'chrono'
    | 'field'
    | 'digital'
    | 'smart'
    | 'open',
];

export const watchProfiles: Readonly<Record<string, WatchProfile>> = {
  'casiot-g-shok': ['octagon', 'black', '#354C40', 'rubber', 'digital'],
  'casiot-gold': ['square', 'gold', '#3E473B', 'fine-links', 'digital'],
  'timexa-weekender': ['round', 'steel', '#EBDCC0', 'fabric', 'field'],
  'fossell-chrono': ['round', 'black', '#232B36', 'leather', 'chrono'],
  'seyko-presago': ['round', 'steel', '#326387', 'leather', 'date'],
  'seyko-diver': ['round', 'steel', '#223E52', 'rubber', 'dive'],
  'tissoe-prx': ['octagon', 'steel', '#275F61', 'fine-links', 'date'],
  'hamiltone-khaki': ['round', 'steel', '#393D32', 'fabric', 'field'],
  'apple-ish': ['square', 'titanium', '#253040', 'fabric', 'smart'],
  'tagg-carrara': ['round', 'steel', '#E2DCD1', 'links', 'chrono'],
  'tagg-monako': ['square', 'steel', '#285886', 'leather', 'chrono'],
  'tudar-black-cove': ['round', 'steel', '#272E36', 'fabric', 'dive'],
  'longinez-spirit': ['round', 'steel', '#353D47', 'leather', 'field'],
  'oris-diver': ['round', 'steel', '#235A55', 'links', 'dive'],
  'breitlong-navigator': ['round', 'steel', '#26303E', 'leather', 'chrono'],
  'grand-seyko-snowflake': ['round', 'titanium', '#EEEDE9', 'links', 'date'],
  'omegon-speedmeister': ['round', 'steel', '#24272C', 'links', 'chrono'],
  'omegon-seamarine': ['round', 'steel', '#23496C', 'rubber', 'dive'],
  'cartrier-tanque': ['tank', 'gold', '#F3E8CE', 'leather', 'plain'],
  'cartrier-santo': ['square', 'steel', '#EAE2CB', 'fine-links', 'plain'],
  'rolux-datesure': ['round', 'steel', '#355D83', 'fine-links', 'date'],
  'rolux-subaquatic': ['round', 'steel', '#153A32', 'links', 'dive'],
  'rolux-gmt': ['round', 'steel', '#232E3D', 'fine-links', 'gmt'],
  'rolux-daytonna': ['round', 'steel', '#EEE6D6', 'links', 'chrono'],
  'rolux-day-date': ['round', 'gold', '#C5A45F', 'fine-links', 'day-date'],
  'iwc-pilot': ['round', 'black', '#242D39', 'leather', 'field'],
  'jaeger-reverso': ['tank', 'steel', '#EEE0CB', 'leather', 'plain'],
  'panerai-luminor': ['barrel', 'steel', '#202E34', 'rubber', 'field'],
  'zenith-chrono': ['round', 'steel', '#E7E4DC', 'links', 'chrono'],
  'blancpain-fifty': ['round', 'black', '#222F38', 'fabric', 'dive'],
  'ap-royal-ash': ['octagon', 'steel', '#364768', 'links', 'date'],
  'patrek-calatrova': ['round', 'gold', '#E6D2B6', 'leather', 'plain'],
  'patrek-nautilos': ['octagon', 'steel', '#456778', 'fine-links', 'date'],
  'vacheran-overseas': ['octagon', 'steel', '#35487D', 'links', 'date'],
  'langer-lange1': ['round', 'rose', '#E4CFBA', 'leather', 'date'],
  'millon-rm': ['barrel', 'black', '#223439', 'rubber', 'open'],
  'patrek-grand-comp': ['round', 'rose', '#594758', 'leather', 'chrono'],
  'rolux-yacht-voyager': ['round', 'titanium', '#526C78', 'rubber', 'dive'],
  'rolux-perpetual': ['round', 'steel', '#417F7A', 'links', 'plain'],
  'rolux-explorer': ['round', 'steel', '#272C36', 'links', 'field'],
  'seyko-alpinist': ['round', 'steel', '#264B39', 'leather', 'field'],
  'tissoe-gentleperson': ['round', 'steel', '#555D69', 'links', 'date'],
  'hamiltone-ventura': ['triangle', 'steel', '#262E3A', 'leather', 'plain'],
  'grand-seyko-birch': ['round', 'steel', '#DAD8C9', 'fine-links', 'date'],
  'tudar-pelagos': ['round', 'titanium', '#245780', 'links', 'dive'],
  'longinez-legend-diver': ['round', 'steel', '#302C31', 'rubber', 'dive'],
  'orys-pointer-date': ['round', 'rose', '#782F43', 'leather', 'date'],
  'omegon-aquaterra': ['round', 'steel', '#35746C', 'links', 'date'],
  'cartrier-ballon': ['round', 'rose', '#F1E5CF', 'fine-links', 'plain'],
  'breitlong-superocean': ['round', 'steel', '#287F8B', 'rubber', 'dive'],
  'ap-royal-ash-offshore': ['octagon', 'black', '#28354A', 'rubber', 'chrono'],
  'patrek-aquanote': ['octagon', 'steel', '#385F45', 'rubber', 'date'],
  'vacheran-patrimony': ['round', 'rose', '#E7CCB9', 'leather', 'plain'],
  'langer-saxonia': ['round', 'rose', '#28343C', 'leather', 'plain'],
  'jakob-timeless-treasure': ['tank', 'gold', '#6B572B', 'gems', 'open'],
};
