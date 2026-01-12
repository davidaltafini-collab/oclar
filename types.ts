export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  details?: string[];
  colors?: string[]; // Hex codes or CSS colors
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
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  toggleCart: () => void;
  clearCart: () => void;
}

export enum CookieChoice {
  ACCEPTED_ALL = 'ACCEPTED_ALL',
  ACCEPTED_ESSENTIAL = 'ACCEPTED_ESSENTIAL',
  REJECTED_ALL = 'REJECTED_ALL'
}