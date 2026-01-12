import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { CartContextType, CartItem, Product } from '../types';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('lumina_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading cart:', e);
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('lumina_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  }, [cart]);

  const addToCart = (product: Product, color?: string) => {
    setCart((prev) => {
      // Create a unique identifier based on ID AND Color
      const existing = prev.find((item) => 
        item.id === product.id && item.selectedColor === color
      );
      
      if (existing) {
        return prev.map((item) =>
          (item.id === product.id && item.selectedColor === color) 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      
      return [...prev, { ...product, quantity: 1, selectedColor: color }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: number, selectedColor?: string) => {
    setCart((prev) => {
      // If color is specified, remove only that variant
      if (selectedColor !== undefined) {
        return prev.filter((item) => 
          !(item.id === productId && item.selectedColor === selectedColor)
        );
      }
      // Otherwise remove all variants of this product
      return prev.filter((item) => item.id !== productId);
    });
  };

  const updateQuantity = (productId: number, quantity: number, selectedColor?: string) => {
    if (quantity < 1) {
      removeFromCart(productId, selectedColor);
      return;
    }
    
    setCart((prev) =>
      prev.map((item) => {
        // If color is specified, update only that variant
        if (selectedColor !== undefined) {
          return (item.id === productId && item.selectedColor === selectedColor)
            ? { ...item, quantity }
            : item;
        }
        // Otherwise update the first matching product
        return item.id === productId ? { ...item, quantity } : item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('lumina_cart');
  };

  const toggleCart = () => setIsCartOpen((prev) => !prev);

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        isCartOpen,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        toggleCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};