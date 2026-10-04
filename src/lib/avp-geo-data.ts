// Coordenadas Geográficas e Metadados Cartográficos dos 101 Municípios da Fila Grupo AVP
import { GrupoAvpAso, AsoStatus } from "./grupo-avp-asos-data";

export interface CityGeoCoordinate {
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  x: number; // Projeção SVG (0 a 800)
  y: number; // Projeção SVG (0 a 800)
  region: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
}

// Limites Geográficos para Projeção Cartográfica no Brasil
const MIN_LAT = -34.5;
const MAX_LAT = 6.0;
const MIN_LNG = -74.5;
const MAX_LNG = -34.0;
const SVG_WIDTH = 800;
const SVG_HEIGHT = 800;

export function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  const x = Number((((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * SVG_WIDTH).toFixed(1));
  const y = Number((((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * SVG_HEIGHT).toFixed(1));
  return { x, y };
}

// Mapeamento dos 101 Municípios Únicos do Grupo AVP (223 ASOs)
export const AVP_CITY_COORDINATES: Record<string, CityGeoCoordinate> = {
  "Abaetetuba-PA": {
    cidade: "Abaetetuba",
    uf: "PA",
    lat: -1.7218,
    lng: -48.8833,
    ...projectLatLng(-1.7218, -48.8833),
    region: "Norte",
  },
  "Acailandia-MA": {
    cidade: "Acailandia",
    uf: "MA",
    lat: -4.9539,
    lng: -47.5031,
    ...projectLatLng(-4.9539, -47.5031),
    region: "Nordeste",
  },
  "Acaraú-CE": {
    cidade: "Acaraú",
    uf: "CE",
    lat: -2.8856,
    lng: -40.12,
    ...projectLatLng(-2.8856, -40.12),
    region: "Nordeste",
  },
  "Alfenas-MG": {
    cidade: "Alfenas",
    uf: "MG",
    lat: -21.4258,
    lng: -45.9469,
    ...projectLatLng(-21.4258, -45.9469),
    region: "Sudeste",
  },
  "Altamira-PA": {
    cidade: "Altamira",
    uf: "PA",
    lat: -3.2033,
    lng: -52.2064,
    ...projectLatLng(-3.2033, -52.2064),
    region: "Norte",
  },
  "Ananindeua-PA": {
    cidade: "Ananindeua",
    uf: "PA",
    lat: -1.3656,
    lng: -48.3744,
    ...projectLatLng(-1.3656, -48.3744),
    region: "Norte",
  },
  "Anapolis-GO": {
    cidade: "Anapolis",
    uf: "GO",
    lat: -16.3267,
    lng: -48.9533,
    ...projectLatLng(-16.3267, -48.9533),
    region: "Centro-Oeste",
  },
  "Apucarana-PR": {
    cidade: "Apucarana",
    uf: "PR",
    lat: -23.5519,
    lng: -51.4614,
    ...projectLatLng(-23.5519, -51.4614),
    region: "Sul",
  },
  "Aracaju-SE": {
    cidade: "Aracaju",
    uf: "SE",
    lat: -10.9472,
    lng: -37.0731,
    ...projectLatLng(-10.9472, -37.0731),
    region: "Nordeste",
  },
  "Aracatuba-SP": {
    cidade: "Aracatuba",
    uf: "SP",
    lat: -21.2089,
    lng: -50.4328,
    ...projectLatLng(-21.2089, -50.4328),
    region: "Sudeste",
  },
  "Araguaína-TO": {
    cidade: "Araguaína",
    uf: "TO",
    lat: -7.1925,
    lng: -48.2044,
    ...projectLatLng(-7.1925, -48.2044),
    region: "Norte",
  },
  "Araripina-PE": {
    cidade: "Araripina",
    uf: "PE",
    lat: -7.5761,
    lng: -40.4983,
    ...projectLatLng(-7.5761, -40.4983),
    region: "Nordeste",
  },
  "Araruama-RJ": {
    cidade: "Araruama",
    uf: "RJ",
    lat: -22.8731,
    lng: -42.3431,
    ...projectLatLng(-22.8731, -42.3431),
    region: "Sudeste",
  },
  "Araxa-MG": {
    cidade: "Araxa",
    uf: "MG",
    lat: -19.5933,
    lng: -46.9406,
    ...projectLatLng(-19.5933, -46.9406),
    region: "Sudeste",
  },
  "Assu-RN": {
    cidade: "Assu",
    uf: "RN",
    lat: -5.5764,
    lng: -36.9081,
    ...projectLatLng(-5.5764, -36.9081),
    region: "Nordeste",
  },
  "BALSAS-MA": {
    cidade: "BALSAS",
    uf: "MA",
    lat: -7.5322,
    lng: -46.0356,
    ...projectLatLng(-7.5322, -46.0356),
    region: "Nordeste",
  },
  "Barcarena-PA": {
    cidade: "Barcarena",
    uf: "PA",
    lat: -1.5058,
    lng: -48.6258,
    ...projectLatLng(-1.5058, -48.6258),
    region: "Norte",
  },
  "Barra Do Corda-MA": {
    cidade: "Barra Do Corda",
    uf: "MA",
    lat: -5.5033,
    lng: -45.2428,
    ...projectLatLng(-5.5033, -45.2428),
    region: "Nordeste",
  },
  "Barra Do Pirai-RJ": {
    cidade: "Barra Do Pirai",
    uf: "RJ",
    lat: -22.4708,
    lng: -43.8256,
    ...projectLatLng(-22.4708, -43.8256),
    region: "Sudeste",
  },
  "Barreirinhas-MA": {
    cidade: "Barreirinhas",
    uf: "MA",
    lat: -2.7561,
    lng: -42.8258,
    ...projectLatLng(-2.7561, -42.8258),
    region: "Nordeste",
  },
  "Belo Horizonte-MG": {
    cidade: "Belo Horizonte",
    uf: "MG",
    lat: -19.9167,
    lng: -43.9345,
    ...projectLatLng(-19.9167, -43.9345),
    region: "Sudeste",
  },
  "Belo Jardim-PE": {
    cidade: "Belo Jardim",
    uf: "PE",
    lat: -8.3336,
    lng: -36.4236,
    ...projectLatLng(-8.3336, -36.4236),
    region: "Nordeste",
  },
  "Boa Vista-RO": {
    cidade: "Boa Vista",
    uf: "RO",
    lat: -11.0,
    lng: -62.0,
    ...projectLatLng(-11.0, -62.0),
    region: "Norte",
  },
  "Bragança Paulista-SP": {
    cidade: "Bragança Paulista",
    uf: "SP",
    lat: -22.9525,
    lng: -46.5419,
    ...projectLatLng(-22.9525, -46.5419),
    region: "Sudeste",
  },
  "Cachoeiro De Itapemirim-ES": {
    cidade: "Cachoeiro De Itapemirim",
    uf: "ES",
    lat: -20.8489,
    lng: -41.1128,
    ...projectLatLng(-20.8489, -41.1128),
    region: "Sudeste",
  },
  "Cacoal-RO": {
    cidade: "Cacoal",
    uf: "RO",
    lat: -11.4386,
    lng: -61.4472,
    ...projectLatLng(-11.4386, -61.4472),
    region: "Norte",
  },
  "Cajazeiras-BA": {
    cidade: "Cajazeiras",
    uf: "BA",
    lat: -12.9,
    lng: -38.4,
    ...projectLatLng(-12.9, -38.4),
    region: "Nordeste",
  },
  "Campina Grande-PB": {
    cidade: "Campina Grande",
    uf: "PB",
    lat: -7.2217,
    lng: -35.8828,
    ...projectLatLng(-7.2217, -35.8828),
    region: "Nordeste",
  },
  "Carpina-PE": {
    cidade: "Carpina",
    uf: "PE",
    lat: -7.8503,
    lng: -35.2467,
    ...projectLatLng(-7.8503, -35.2467),
    region: "Nordeste",
  },
  "Casa Nova-BA": {
    cidade: "Casa Nova",
    uf: "BA",
    lat: -9.1617,
    lng: -40.9706,
    ...projectLatLng(-9.1617, -40.9706),
    region: "Nordeste",
  },
  "Cascavel-PR": {
    cidade: "Cascavel",
    uf: "PR",
    lat: -24.9578,
    lng: -53.4597,
    ...projectLatLng(-24.9578, -53.4597),
    region: "Sul",
  },
  "Caucaia-PE": {
    cidade: "Caucaia",
    uf: "PE",
    lat: -3.7319,
    lng: -38.6531,
    ...projectLatLng(-3.7319, -38.6531),
    region: "Nordeste",
  },
  "Chapeco-SC": {
    cidade: "Chapeco",
    uf: "SC",
    lat: -27.1006,
    lng: -52.6153,
    ...projectLatLng(-27.1006, -52.6153),
    region: "Sul",
  },
  "Codo-MA": {
    cidade: "Codo",
    uf: "MA",
    lat: -4.4553,
    lng: -43.8856,
    ...projectLatLng(-4.4553, -43.8856),
    region: "Nordeste",
  },
  "Crateus-CE": {
    cidade: "Crateus",
    uf: "CE",
    lat: -5.1783,
    lng: -40.6775,
    ...projectLatLng(-5.1783, -40.6775),
    region: "Nordeste",
  },
  "Criciuma-SC": {
    cidade: "Criciuma",
    uf: "SC",
    lat: -28.6775,
    lng: -49.3703,
    ...projectLatLng(-28.6775, -49.3703),
    region: "Sul",
  },
  "Divinopolis-MG": {
    cidade: "Divinopolis",
    uf: "MG",
    lat: -20.1436,
    lng: -44.8886,
    ...projectLatLng(-20.1436, -44.8886),
    region: "Sudeste",
  },
  "Eusebio-CE": {
    cidade: "Eusebio",
    uf: "CE",
    lat: -3.8911,
    lng: -38.4594,
    ...projectLatLng(-3.8911, -38.4594),
    region: "Nordeste",
  },
  "Formiga-MG": {
    cidade: "Formiga",
    uf: "MG",
    lat: -20.4636,
    lng: -45.4264,
    ...projectLatLng(-20.4636, -45.4264),
    region: "Sudeste",
  },
  "Fortaleza-CE": {
    cidade: "Fortaleza",
    uf: "CE",
    lat: -3.7172,
    lng: -38.5431,
    ...projectLatLng(-3.7172, -38.5431),
    region: "Nordeste",
  },
  "Franca-SP": {
    cidade: "Franca",
    uf: "SP",
    lat: -20.5386,
    lng: -47.4008,
    ...projectLatLng(-20.5386, -47.4008),
    region: "Sudeste",
  },
  "Francisco Beltrao-PR": {
    cidade: "Francisco Beltrão",
    uf: "PR",
    lat: -26.0778,
    lng: -53.0556,
    ...projectLatLng(-26.0778, -53.0556),
    region: "Sul",
  },
  "Francisco Beltrão-PR": {
    cidade: "Francisco Beltrão",
    uf: "PR",
    lat: -26.0778,
    lng: -53.0556,
    ...projectLatLng(-26.0778, -53.0556),
    region: "Sul",
  },
  "GUANABI-BA": {
    cidade: "GUANABI",
    uf: "BA",
    lat: -14.2258,
    lng: -42.7814,
    ...projectLatLng(-14.2258, -42.7814),
    region: "Nordeste",
  },
  "Guarapari-ES": {
    cidade: "Guarapari",
    uf: "ES",
    lat: -20.6708,
    lng: -40.4981,
    ...projectLatLng(-20.6708, -40.4981),
    region: "Sudeste",
  },
  "Guarapuava-PR": {
    cidade: "Guarapuava",
    uf: "PR",
    lat: -25.3953,
    lng: -51.4625,
    ...projectLatLng(-25.3953, -51.4625),
    region: "Sul",
  },
  "Guaratingueta-SP": {
    cidade: "Guaratingueta",
    uf: "SP",
    lat: -22.8164,
    lng: -45.1925,
    ...projectLatLng(-22.8164, -45.1925),
    region: "Sudeste",
  },
  "HUMAITA-AM": {
    cidade: "HUMAITA",
    uf: "AM",
    lat: -7.5061,
    lng: -63.0325,
    ...projectLatLng(-7.5061, -63.0325),
    region: "Norte",
  },
  "Horizonte-CE": {
    cidade: "Horizonte",
    uf: "CE",
    lat: -4.0958,
    lng: -38.4975,
    ...projectLatLng(-4.0958, -38.4975),
    region: "Nordeste",
  },
  "Ilhéus-BA": {
    cidade: "Ilhéus",
    uf: "BA",
    lat: -14.7889,
    lng: -39.0494,
    ...projectLatLng(-14.7889, -39.0494),
    region: "Nordeste",
  },
  "Itaberaba-BA": {
    cidade: "Itaberaba",
    uf: "BA",
    lat: -12.5275,
    lng: -40.3069,
    ...projectLatLng(-12.5275, -40.3069),
    region: "Nordeste",
  },
  "Itacoatira-AM": {
    cidade: "Itacoatira",
    uf: "AM",
    lat: -3.1431,
    lng: -58.4442,
    ...projectLatLng(-3.1431, -58.4442),
    region: "Norte",
  },
  "Itaguai-RJ": {
    cidade: "Itaguai",
    uf: "RJ",
    lat: -22.8522,
    lng: -43.7753,
    ...projectLatLng(-22.8522, -43.7753),
    region: "Sudeste",
  },
  "Itapecuru-Mirim-MA": {
    cidade: "Itapecuru-Mirim",
    uf: "MA",
    lat: -3.3939,
    lng: -44.3589,
    ...projectLatLng(-3.3939, -44.3589),
    region: "Nordeste",
  },
  "Itapipoca-CE": {
    cidade: "Itapipoca",
    uf: "CE",
    lat: -3.4944,
    lng: -39.5786,
    ...projectLatLng(-3.4944, -39.5786),
    region: "Nordeste",
  },
  "Ituiutaba-MG": {
    cidade: "Ituiutaba",
    uf: "MG",
    lat: -18.9689,
    lng: -49.4647,
    ...projectLatLng(-18.9689, -49.4647),
    region: "Sudeste",
  },
  "Ji-Parana-RO": {
    cidade: "Ji-Parana",
    uf: "RO",
    lat: -10.8847,
    lng: -61.9514,
    ...projectLatLng(-10.8847, -61.9514),
    region: "Norte",
  },
  "Joao Pessoa-PB": {
    cidade: "Joao Pessoa",
    uf: "PB",
    lat: -7.1153,
    lng: -34.8611,
    ...projectLatLng(-7.1153, -34.8611),
    region: "Nordeste",
  },
  "Juiz De Fora-MG": {
    cidade: "Juiz De Fora",
    uf: "MG",
    lat: -21.7586,
    lng: -43.3444,
    ...projectLatLng(-21.7586, -43.3444),
    region: "Sudeste",
  },
  "MANHUAÇU-MG": {
    cidade: "MANHUAÇU",
    uf: "MG",
    lat: -20.2575,
    lng: -42.0336,
    ...projectLatLng(-20.2575, -42.0336),
    region: "Sudeste",
  },
  "Macaé-RJ": {
    cidade: "Macaé",
    uf: "RJ",
    lat: -22.3769,
    lng: -41.7869,
    ...projectLatLng(-22.3769, -41.7869),
    region: "Sudeste",
  },
  "Maracanau-CE": {
    cidade: "Maracanau",
    uf: "CE",
    lat: -3.8767,
    lng: -38.6256,
    ...projectLatLng(-3.8767, -38.6256),
    region: "Nordeste",
  },
  "Maracanaú-CE": {
    cidade: "Maracanaú",
    uf: "CE",
    lat: -3.8767,
    lng: -38.6256,
    ...projectLatLng(-3.8767, -38.6256),
    region: "Nordeste",
  },
  "Maranguape-CE": {
    cidade: "Maranguape",
    uf: "CE",
    lat: -3.8894,
    lng: -38.6811,
    ...projectLatLng(-3.8894, -38.6811),
    region: "Nordeste",
  },
  "Mariana-MG": {
    cidade: "Mariana",
    uf: "MG",
    lat: -20.3778,
    lng: -43.4161,
    ...projectLatLng(-20.3778, -43.4161),
    region: "Sudeste",
  },
  "Mossoro-RN": {
    cidade: "Mossoro",
    uf: "RN",
    lat: -5.1878,
    lng: -37.3442,
    ...projectLatLng(-5.1878, -37.3442),
    region: "Nordeste",
  },
  "Natal-RN": {
    cidade: "Natal",
    uf: "RN",
    lat: -5.7945,
    lng: -35.211,
    ...projectLatLng(-5.7945, -35.211),
    region: "Nordeste",
  },
  "Nova Friburgo-RJ": {
    cidade: "Nova Friburgo",
    uf: "RJ",
    lat: -22.2819,
    lng: -42.5311,
    ...projectLatLng(-22.2819, -42.5311),
    region: "Sudeste",
  },
  "Novo Repartimento-PA": {
    cidade: "Novo Repartimento",
    uf: "PA",
    lat: -4.2503,
    lng: -49.9486,
    ...projectLatLng(-4.2503, -49.9486),
    region: "Norte",
  },
  "PALMAS-TO": {
    cidade: "PALMAS",
    uf: "TO",
    lat: -10.1844,
    lng: -48.3336,
    ...projectLatLng(-10.1844, -48.3336),
    region: "Norte",
  },
  "Palmares-PE": {
    cidade: "Palmares",
    uf: "PE",
    lat: -8.6833,
    lng: -35.5917,
    ...projectLatLng(-8.6833, -35.5917),
    region: "Nordeste",
  },
  "Paranaguá-PR": {
    cidade: "Paranaguá",
    uf: "PR",
    lat: -25.5206,
    lng: -48.5092,
    ...projectLatLng(-25.5206, -48.5092),
    region: "Sul",
  },
  "Parnamirim-RN": {
    cidade: "Parnamirim",
    uf: "RN",
    lat: -5.9156,
    lng: -35.2628,
    ...projectLatLng(-5.9156, -35.2628),
    region: "Nordeste",
  },
  "Petrópolis-RJ": {
    cidade: "Petrópolis",
    uf: "RJ",
    lat: -22.505,
    lng: -43.1789,
    ...projectLatLng(-22.505, -43.1789),
    region: "Sudeste",
  },
  "Porto Seguro-BA": {
    cidade: "Porto Seguro",
    uf: "BA",
    lat: -16.4497,
    lng: -39.0647,
    ...projectLatLng(-16.4497, -39.0647),
    region: "Nordeste",
  },
  "Recife-PE": {
    cidade: "Recife",
    uf: "PE",
    lat: -8.0476,
    lng: -34.877,
    ...projectLatLng(-8.0476, -34.877),
    region: "Nordeste",
  },
  "Santa Ines-MA": {
    cidade: "Santa Ines",
    uf: "MA",
    lat: -3.6667,
    lng: -45.38,
    ...projectLatLng(-3.6667, -45.38),
    region: "Nordeste",
  },
  "Santa Izabel Do Para-PA": {
    cidade: "Santa Izabel Do Para",
    uf: "PA",
    lat: -1.2969,
    lng: -48.1606,
    ...projectLatLng(-1.2969, -48.1606),
    region: "Norte",
  },
  "Santa Maria-RS": {
    cidade: "Santa Maria",
    uf: "RS",
    lat: -29.6842,
    lng: -53.8069,
    ...projectLatLng(-29.6842, -53.8069),
    region: "Sul",
  },
  "Santa Rita-PB": {
    cidade: "Santa Rita",
    uf: "PB",
    lat: -7.1139,
    lng: -34.9781,
    ...projectLatLng(-7.1139, -34.9781),
    region: "Nordeste",
  },
  "Santana Do Araguaia-PA": {
    cidade: "Santana Do Araguaia",
    uf: "PA",
    lat: -9.3047,
    lng: -50.3375,
    ...projectLatLng(-9.3047, -50.3375),
    region: "Norte",
  },
  "Santarem-PA": {
    cidade: "Santarem",
    uf: "PA",
    lat: -2.4431,
    lng: -54.7083,
    ...projectLatLng(-2.4431, -54.7083),
    region: "Norte",
  },
  "Sao Francisco-MG": {
    cidade: "Sao Francisco",
    uf: "MG",
    lat: -15.9489,
    lng: -44.8644,
    ...projectLatLng(-15.9489, -44.8644),
    region: "Sudeste",
  },
  "Sao Joao Del Rei-MG": {
    cidade: "Sao Joao Del Rei",
    uf: "MG",
    lat: -21.1356,
    lng: -44.2617,
    ...projectLatLng(-21.1356, -44.2617),
    region: "Sudeste",
  },
  "Sao Leopoldo-RS": {
    cidade: "Sao Leopoldo",
    uf: "RS",
    lat: -29.7547,
    lng: -51.1478,
    ...projectLatLng(-29.7547, -51.1478),
    region: "Sul",
  },
  "Senhor Do Bomfim-BA": {
    cidade: "Senhor Do Bomfim",
    uf: "BA",
    lat: -10.4614,
    lng: -40.1894,
    ...projectLatLng(-10.4614, -40.1894),
    region: "Nordeste",
  },
  "Serrinha-BA": {
    cidade: "Serrinha",
    uf: "BA",
    lat: -11.6617,
    lng: -39.0089,
    ...projectLatLng(-11.6617, -39.0089),
    region: "Nordeste",
  },
  "Sete Lagoas-MG": {
    cidade: "Sete Lagoas",
    uf: "MG",
    lat: -19.4658,
    lng: -44.2467,
    ...projectLatLng(-19.4658, -44.2467),
    region: "Sudeste",
  },
  "Sobral-CE": {
    cidade: "Sobral",
    uf: "CE",
    lat: -3.6894,
    lng: -40.3486,
    ...projectLatLng(-3.6894, -40.3486),
    region: "Nordeste",
  },
  "São José Cachoeira Do Sul-RS": {
    cidade: "São José Cachoeira Do Sul",
    uf: "RS",
    lat: -30.0389,
    lng: -52.8986,
    ...projectLatLng(-30.0389, -52.8986),
    region: "Sul",
  },
  "São Luis-MA": {
    cidade: "São Luis",
    uf: "MA",
    lat: -2.5387,
    lng: -44.2825,
    ...projectLatLng(-2.5387, -44.2825),
    region: "Nordeste",
  },
  "TOMÉ-AÇU-PA": {
    cidade: "TOMÉ-AÇU",
    uf: "PA",
    lat: -2.4172,
    lng: -48.1517,
    ...projectLatLng(-2.4172, -48.1517),
    region: "Norte",
  },
  "Taubaté-SP": {
    cidade: "Taubaté",
    uf: "SP",
    lat: -23.0264,
    lng: -45.5553,
    ...projectLatLng(-23.0264, -45.5553),
    region: "Sudeste",
  },
  "Tefe-AM": {
    cidade: "Tefe",
    uf: "AM",
    lat: -3.3547,
    lng: -64.7139,
    ...projectLatLng(-3.3547, -64.7139),
    region: "Norte",
  },
  "Toledo-PR": {
    cidade: "Toledo",
    uf: "PR",
    lat: -24.7139,
    lng: -53.7431,
    ...projectLatLng(-24.7139, -53.7431),
    region: "Sul",
  },
  "Três Lagoas-MS": {
    cidade: "Três Lagoas",
    uf: "MS",
    lat: -20.785,
    lng: -51.7019,
    ...projectLatLng(-20.785, -51.7019),
    region: "Centro-Oeste",
  },
  "Uba-MG": {
    cidade: "Uba",
    uf: "MG",
    lat: -21.1206,
    lng: -42.9428,
    ...projectLatLng(-21.1206, -42.9428),
    region: "Sudeste",
  },
  "Valença-BA": {
    cidade: "Valença",
    uf: "BA",
    lat: -13.3703,
    lng: -39.0731,
    ...projectLatLng(-13.3703, -39.0731),
    region: "Nordeste",
  },
  "Vila Velha-ES": {
    cidade: "Vila Velha",
    uf: "ES",
    lat: -20.3297,
    lng: -40.2925,
    ...projectLatLng(-20.3297, -40.2925),
    region: "Sudeste",
  },
  "Vitoria Da Conquista-BA": {
    cidade: "Vitoria Da Conquista",
    uf: "BA",
    lat: -14.8661,
    lng: -40.8394,
    ...projectLatLng(-14.8661, -40.8394),
    region: "Nordeste",
  },
  "Volta Redonda-RJ": {
    cidade: "Volta Redonda",
    uf: "RJ",
    lat: -22.5231,
    lng: -44.1042,
    ...projectLatLng(-22.5231, -44.1042),
    region: "Sudeste",
  },
  "São Francisco-MG": {
    cidade: "São Francisco",
    uf: "MG",
    lat: -15.9489,
    lng: -44.8644,
    ...projectLatLng(-15.9489, -44.8644),
    region: "Sudeste",
  },
  "TRES LAGOAS-MS": {
    cidade: "TRES LAGOAS",
    uf: "MS",
    lat: -20.7849,
    lng: -51.7011,
    ...projectLatLng(-20.7849, -51.7011),
    region: "Centro-Oeste",
  },
  "TRES LAGOAS-BR": {
    cidade: "TRES LAGOAS",
    uf: "BR",
    lat: -20.7849,
    lng: -51.7011,
    ...projectLatLng(-20.7849, -51.7011),
    region: "Centro-Oeste",
  },
  "Aracati-CE": {
    cidade: "Aracati",
    uf: "CE",
    lat: -4.5617,
    lng: -37.7686,
    ...projectLatLng(-4.5617, -37.7686),
    region: "Nordeste",
  },
  "Manaus-AM": {
    cidade: "Manaus",
    uf: "AM",
    lat: -3.119,
    lng: -60.0217,
    ...projectLatLng(-3.119, -60.0217),
    region: "Norte",
  },
  "Caucaia-CE": {
    cidade: "Caucaia",
    uf: "CE",
    lat: -3.7364,
    lng: -38.6531,
    ...projectLatLng(-3.7364, -38.6531),
    region: "Nordeste",
  },
  "São Leopoldo-RS": {
    cidade: "São Leopoldo",
    uf: "RS",
    lat: -29.7547,
    lng: -51.1472,
    ...projectLatLng(-29.7547, -51.1472),
    region: "Sul",
  },
  "Caxias-MA": {
    cidade: "Caxias",
    uf: "MA",
    lat: -4.8589,
    lng: -43.3561,
    ...projectLatLng(-4.8589, -43.3561),
    region: "Nordeste",
  },
  "Tefé-AM": {
    cidade: "Tefé",
    uf: "AM",
    lat: -3.3547,
    lng: -64.7114,
    ...projectLatLng(-3.3547, -64.7114),
    region: "Norte",
  },
  "Criciúma-SC": {
    cidade: "Criciúma",
    uf: "SC",
    lat: -28.6775,
    lng: -49.3703,
    ...projectLatLng(-28.6775, -49.3703),
    region: "Sul",
  },
  "Timon-MA": {
    cidade: "Timon",
    uf: "MA",
    lat: -5.0939,
    lng: -42.8361,
    ...projectLatLng(-5.0939, -42.8361),
    region: "Nordeste",
  },
};

export interface StatusConfig {
  label: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  badgeClass: string;
}

export const ASO_STATUS_CONFIG: Record<string, StatusConfig> = {
  AGENDADO: {
    label: "Agendado",
    color: "#10b981", // Emerald 500
    bgLight: "rgba(16, 185, 129, 0.15)",
    borderColor: "#059669",
    textColor: "#065f46",
    badgeClass: "bg-emerald-500 text-white",
  },
  "NÃO INICIADO": {
    label: "Não Iniciado",
    color: "#f59e0b", // Amber 500
    bgLight: "rgba(245, 158, 11, 0.15)",
    borderColor: "#d97706",
    textColor: "#92400e",
    badgeClass: "bg-amber-500 text-white",
  },
  URGENTE: {
    label: "Urgente",
    color: "#ef4444", // Rose/Red 500
    bgLight: "rgba(239, 68, 68, 0.2)",
    borderColor: "#dc2626",
    textColor: "#991b1b",
    badgeClass: "bg-rose-600 text-white animate-pulse",
  },
  "EXAME FEITO": {
    label: "Exame Feito",
    color: "#2563eb", // Blue 600
    bgLight: "rgba(37, 99, 235, 0.15)",
    borderColor: "#1d4ed8",
    textColor: "#1e40af",
    badgeClass: "bg-blue-600 text-white",
  },
  "2 VIA ASO": {
    label: "2ª Via ASO",
    color: "#9333ea", // Purple 600
    bgLight: "rgba(147, 51, 234, 0.15)",
    borderColor: "#7e22ce",
    textColor: "#6b21a8",
    badgeClass: "bg-purple-600 text-white",
  },
  "CADASTRANDO NO SOC": {
    label: "Cadastrando SOC",
    color: "#4f46e5", // Indigo 600
    bgLight: "rgba(79, 70, 229, 0.15)",
    borderColor: "#4338ca",
    textColor: "#3730a3",
    badgeClass: "bg-indigo-600 text-white",
  },
  REAGENDAMENTO: {
    label: "Reagendamento",
    color: "#ea580c", // Orange 600
    bgLight: "rgba(234, 88, 12, 0.15)",
    borderColor: "#c2410c",
    textColor: "#9a3412",
    badgeClass: "bg-orange-500 text-white",
  },
  "AG. RETORNO CLINICA": {
    label: "Ag. Retorno Clínica",
    color: "#06b6d4", // Cyan 500
    bgLight: "rgba(6, 182, 212, 0.15)",
    borderColor: "#0891b2",
    textColor: "#155e75",
    badgeClass: "bg-cyan-600 text-white",
  },
  "ENVIAR COMPROV. PAG": {
    label: "Enviar Comprov. PIX",
    color: "#e11d48", // Rose 600
    bgLight: "rgba(225, 29, 72, 0.15)",
    borderColor: "#be123c",
    textColor: "#881337",
    badgeClass: "bg-rose-500 text-white",
  },
  "GESTOR CANCELOU": {
    label: "Gestor Cancelou",
    color: "#64748b", // Slate 500
    bgLight: "rgba(100, 116, 139, 0.15)",
    borderColor: "#475569",
    textColor: "#334155",
    badgeClass: "bg-slate-500 text-white",
  },
  "DESISTIU DA VAGA": {
    label: "Desistiu da Vaga",
    color: "#475569", // Slate 600
    bgLight: "rgba(71, 85, 105, 0.15)",
    borderColor: "#334155",
    textColor: "#1e293b",
    badgeClass: "bg-slate-600 text-white",
  },
};

export interface AvpLocalityAggregate {
  key: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  region: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
  totalAsos: number;
  urgentCount: number;
  statusCounts: Record<string, number>;
  primaryStatus: string;
  primaryColor: string;
  hasUrgente: boolean;
  asos: GrupoAvpAso[];
}

/**
 * Agrega a lista de ASOs por município e calcula contagens e status dominante.
 */
export function aggregateAvpLocalities(asos: GrupoAvpAso[]): AvpLocalityAggregate[] {
  const map = new Map<string, { coord: CityGeoCoordinate; items: GrupoAvpAso[] }>();

  asos.forEach((item) => {
    const key = `${item.cidade.trim()}-${item.uf.trim()}`;
    const directCoord = AVP_CITY_COORDINATES[key];

    // Fallback caso pequena variação de acentuação
    const coord = directCoord ||
      Object.values(AVP_CITY_COORDINATES).find(
        (c) => c.cidade.toLowerCase() === item.cidade.toLowerCase() && c.uf === item.uf
      ) || {
        cidade: item.cidade,
        uf: item.uf,
        lat: -15.7938,
        lng: -47.8827,
        x: 400,
        y: 400,
        region: "Centro-Oeste",
      };

    if (!map.has(key)) {
      map.set(key, { coord, items: [] });
    }
    map.get(key)!.items.push(item);
  });

  const aggregates: AvpLocalityAggregate[] = [];

  map.forEach(({ coord, items }, key) => {
    const statusCounts: Record<string, number> = {};
    let urgentCount = 0;

    items.forEach((item) => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      if (item.urgencia === "URGENTE") {
        urgentCount++;
      }
    });

    // Determina o status primário
    let primaryStatus: string = items[0]?.status || "AGENDADO";
    if (urgentCount > 0) {
      primaryStatus = "URGENTE";
    } else {
      // Prioridade: NÃO INICIADO > AGENDADO > REAGENDAMENTO > CADASTRANDO NO SOC > outros
      const priorityOrder = [
        "NÃO INICIADO",
        "AGENDADO",
        "REAGENDAMENTO",
        "CADASTRANDO NO SOC",
        "AG. RETORNO CLINICA",
        "ENVIAR COMPROV. PAG",
        "2 VIA ASO",
        "EXAME FEITO",
        "GESTOR CANCELOU",
        "DESISTIU DA VAGA",
      ];
      for (const p of priorityOrder) {
        if (statusCounts[p]) {
          primaryStatus = p;
          break;
        }
      }
    }

    const primaryColor = ASO_STATUS_CONFIG[primaryStatus]?.color || "#10b981";

    aggregates.push({
      key,
      cidade: coord.cidade,
      uf: coord.uf,
      lat: coord.lat,
      lng: coord.lng,
      x: coord.x,
      y: coord.y,
      region: coord.region,
      totalAsos: items.length,
      urgentCount,
      statusCounts,
      primaryStatus,
      primaryColor,
      hasUrgente: urgentCount > 0,
      asos: items,
    });
  });

  return aggregates.sort((a, b) => b.totalAsos - a.totalAsos);
}
