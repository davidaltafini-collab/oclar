import { Product } from './types';

// API URL configuration - works in both dev and production
export const API_URL = import.meta.env.DEV 
  ? 'http://localhost:3000/api' 
  : '/api';

// Mock data used if backend is not reachable (for UI preview purposes)
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "OclarOrigin - Matte Black",
    description: "Modelul care a început totul. Ramă ultra-ușoară din acetat, lentile premium cu filtrare 40% a luminii albastre. Ideal pentru munca de birou.",
    price: 189.00,
    category: "Daytime",
    imageUrl: "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=1000",
    details: ["Filtru Lumină Albastră: 40%", "Ramă: Acetat Italian", "Greutate: 18g", "Balamale flexibile"],
    colors: ["#171717", "#525252", "#9ca3af"]
  },
  {
    id: 2,
    name: "OclarNight - Amber",
    description: "Proiectați pentru seară. Lentilele chihlimbar blochează 99% din lumina albastră pentru a stimula producția de melatonină și a îmbunătăți somnul.",
    price: 219.00,
    category: "Nighttime",
    imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=1000",
    details: ["Filtru Lumină Albastră: 99%", "Culoare Lentilă: Amber", "Îmbunătățește somnul", "Husă inclusă"],
    colors: ["#78350f", "#000000"]
  },
  {
    id: 3,
    name: "OclarAir - Transparent",
    description: "Invizibili pe față. O estetică minimalistă care se potrivește oricărei ținute. Protecție completă fără a compromite stilul.",
    price: 199.00,
    category: "Daytime",
    imageUrl: "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&q=80&w=1000",
    details: ["Design Unisex", "Tratament Antireflex", "Rezistență la zgârieturi", "Kit curățare inclus"],
    colors: ["#e5e5e5", "#d4d4d4", "#fcd34d"]
  },
  {
    id: 4,
    name: "OclarPro - Titanium",
    description: "Inginerie de top. Ramă din titan pur, extrem de durabilă și flexibilă. Pentru profesioniștii care petrec peste 8 ore în fața ecranelor.",
    price: 450.00,
    category: "Professional",
    imageUrl: "https://images.unsplash.com/photo-1570222094114-28a9d88a27e6?auto=format&fit=crop&q=80&w=1000",
    details: ["Material: Titan", "Filtru UV400", "Lentile Asferice", "Garanție 2 ani"],
    colors: ["#404040", "#a3a3a3", "#FACC15"]
  }
];