import { API_URL } from '../constants';

interface PaymentData {
  items: any[];
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: {
    county: string;
    city: string;
    line: string;
  };
  shippingMethod: string;
  shippingCost: number;
  // 👇 AM ADĂUGAT ACESTE DOUĂ CÂMPURI
  lockerId?: string;
  lockerName?: string;
}

export const processNetopiaPayment = async (data: PaymentData) => {
  try {
    console.log("🚀 Inițiere plată Netopia...", data); // Debug: să vedem ce pleacă

    // 1. Cerem serverului să cripteze datele
    const response = await fetch(`${API_URL}/create-netopia-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Eroare Backend:', result);
      alert('Eroare la inițierea plății: ' + (result.error || 'Necunoscută'));
      return;
    }

    // 2. Construim formularul invizibil
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = result.url; // URL-ul Netopia (Sandbox/Live)
    form.style.display = 'none';

    // Adăugăm câmpurile obligatorii (env_key & data)
    const addField = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addField('env_key', result.env_key);
    addField('data', result.data);

    // 3. Trimitem formularul (Redirect către Netopia)
    document.body.appendChild(form);
    form.submit();

  } catch (error) {
    console.error('Payment Error:', error);
    alert('A apărut o eroare de conexiune.');
  }
};