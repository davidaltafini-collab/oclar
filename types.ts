export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price?: number | null; // Asigură-te că e definit
  imageUrl: string;
  gallery?: string[]; // <--- Câmp nou pentru poze multiple
  category: string;
  details?: string[];
  colors?: string[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedColor?: string;
}

export interface CartContextType {
  cart: CartItem[];
  isCartOpen: boolean;
  cartTotal: number;
  addToCart: (product: Product, color?: string) => void;
  removeFromCart: (productId: number, selectedColor?: string) => void;
  updateQuantity: (productId: number, quantity: number, selectedColor?: string) => void;
  toggleCart: () => void;
  clearCart: () => void;
}

export enum CookieChoice {
  ACCEPTED_ALL = 'ACCEPTED_ALL',
  ACCEPTED_ESSENTIAL = 'ACCEPTED_ESSENTIAL',
  REJECTED_ALL = 'REJECTED_ALL'
}
