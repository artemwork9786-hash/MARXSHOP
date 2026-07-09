import { useState, useEffect, useCallback, useRef } from "react";
import Header from "./components/Header";
import CurrencySwitcher from "./components/CurrencySwitcher";
import AccountCard from "./components/AccountCard";
import BottomNav from "./components/BottomNav";
import InfoTab from "./components/InfoTab";
import ProfileTab from "./components/ProfileTab";
import { CURRENCIES } from "./data/accounts";
import { getAccounts, getRates, createOrder, checkOrder, confirmSbp, verifyInvoice, cancelOrder } from "./api";

function ShopTab({ accounts, currency, setCurrency, rates, onRent }) {
  return (
    <>
      <CurrencySwitcher currency={currency} setCurrency={setCurrency} />
      <div className="grid grid-cols-1 gap-6 px-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            currency={currency}
            rates={rates}
            onRent={() => onRent(account)}
          />
        ))}
      </div>
    </>
  );
}

function App() {
  const [currency, setCurrency] = useState("RUB");
  const [activeTab, setActiveTab] = useState("shop");
  const [activeOrder, setActiveOrder] = useState(null);
  const [paymentTimer, setPaymentTimer] = useState(600);
  const [orderStatus, setOrderStatus] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [payUrl, setPayUrl] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [cryptoInstructions, setCryptoInstructions] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [rates, setRates] = useState({ usd_to_rub: 90, usd_to_uah: 41 });
  const mainButtonRef = useRef(null);
  const pollingRef = useRef(null);
  const activeOrderRef = useRef(null);

  // Keep ref in sync
  activeOrderRef.current = activeOrder;

  // Load accounts and rates from API
  const refreshAccounts = useCallback(() => {
    getAccounts()
      .then((res) => setAccounts(res.accounts))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshAccounts();
    getRates()
      .then((res) => setRates(res))
      .catch(() => {});
  }, [refreshAccounts]);

  // Re-fetch accounts when switching to shop tab
  useEffect(() => {
    if (activeTab === "shop") refreshAccounts();
  }, [activeTab, refreshAccounts]);

  // Telegram init
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      document.body.style.backgroundColor = tg.themeParams?.bg_color || "#0A0A0A";
    }
  }, []);

  // Polling helpers
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (oid) => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const res = await checkOrder(oid);
          if (res.status === "PAID") {
            setOrderStatus("paid");
            setCredentials(res.credentials || null);
            stopPolling();
          } else if (res.status === "EXPIRED") {
            resetAll();
          }
        } catch {
          /* retry */
        }
      }, 3000);
    },
    [stopPolling]
  );

  // Reset all order state
  const resetAll = useCallback(() => {
    setActiveOrder(null);
    setOrderStatus(null);
    setPaymentMethod(null);
    setOrderId(null);
    setPayUrl(null);
    setPaymentDetails(null);
    setCryptoInstructions(null);
    setCredentials(null);
    setPaymentTimer(600);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    const tg = window.Telegram?.WebApp;
    tg?.MainButton?.hide();
  }, []);

  // Cancel order on backend
  const handleClearOrder = useCallback(async () => {
    const order = activeOrderRef.current;
    if (order) {
      try {
        await cancelOrder(order.id);
      } catch {
        /* ignore */
      }
    }
    resetAll();
  }, [resetAll]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // MainButton click handler — SBP "I paid"
  const handleMainButtonClick = useCallback(async () => {
    if (orderStatus === "pending" && paymentMethod === "sbp" && orderId) {
      try {
        await confirmSbp(orderId);
        setOrderStatus("awaiting_verification");
        const tg = window.Telegram?.WebApp;
        if (tg?.MainButton) {
          tg.MainButton.setText("ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ");
          tg.MainButton.offClick(handleMainButtonClick);
        }
      } catch {
        /* ignore */
      }
    }
  }, [orderStatus, paymentMethod, orderId]);

  // MainButton sync
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.MainButton) return;

    if (activeOrder && orderStatus === "pending" && paymentMethod === "sbp") {
      tg.MainButton.setText("Я ОПЛАТИЛ");
      tg.MainButton.show();
      tg.MainButton.onClick(handleMainButtonClick);
      mainButtonRef.current = handleMainButtonClick;
    } else if (activeOrder && orderStatus === "awaiting_verification") {
      tg.MainButton.setText("ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ");
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
      if (mainButtonRef.current) {
        tg.MainButton.offClick(mainButtonRef.current);
        mainButtonRef.current = null;
      }
    }

    return () => {
      if (mainButtonRef.current) {
        tg.MainButton.offClick(mainButtonRef.current);
        mainButtonRef.current = null;
      }
    };
  }, [activeOrder, orderStatus, paymentMethod, handleMainButtonClick]);

  // Payment countdown
  useEffect(() => {
    if (!activeOrder || orderStatus !== "pending" || paymentTimer <= 0) return;
    const id = setInterval(() => {
      setPaymentTimer((t) => {
        if (t <= 1) {
          handleClearOrder();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeOrder, orderStatus, paymentTimer, handleClearOrder]);

  // Step 1: Select account
  const handleRent = useCallback((account) => {
    setActiveOrder(account);
    setPaymentMethod(null);
    setOrderId(null);
    setPayUrl(null);
    setPaymentDetails(null);
    setCryptoInstructions(null);
    setOrderStatus(null);
    setActiveTab("profile");
  }, []);

  // Step 2: Method chosen
  const handleSelectMethod = useCallback(
    async (method) => {
      const order = activeOrderRef.current;
      if (!order) return;
      const tgInitData = window.Telegram?.WebApp?.initData || "";
      try {
        const res = await createOrder({
          accountId: order.id,
          currency,
          method,
          tgInitData,
        });

        setOrderId(res.orderId);
        setPaymentMethod(method);
        setPaymentTimer(600);
        setOrderStatus("pending");
        startPolling(res.orderId);

        if (method === "crypto") {
          setPayUrl(null);
          setPaymentDetails(null);
          setCryptoInstructions(res.instructions);
        } else {
          setPayUrl(null);
          setCryptoInstructions(null);
          setPaymentDetails(res.paymentDetails);
        }
      } catch (err) {
        console.error("Failed to create order:", err);
      }
    },
    [currency, startPolling]
  );

  // Submit invoice ID
  const handleVerifyInvoice = useCallback(
    async (invoiceId) => {
      if (!orderId || !invoiceId) return;
      try {
        await verifyInvoice(orderId, invoiceId);
        setOrderStatus("awaiting_verification");
        setCryptoInstructions(null);
      } catch (err) {
        console.error("Failed to verify invoice:", err);
      }
    },
    [orderId]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[#0A0A0A]">
      <Header />
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === "shop" && (
          <ShopTab accounts={accounts} currency={currency} setCurrency={setCurrency} rates={rates} onRent={handleRent} />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            activeOrder={activeOrder}
            paymentTimer={paymentTimer}
            currency={currency}
            orderStatus={orderStatus}
            paymentMethod={paymentMethod}
            payUrl={payUrl}
            paymentDetails={paymentDetails}
            cryptoInstructions={cryptoInstructions}
            credentials={credentials}
            onSelectMethod={handleSelectMethod}
            onVerifyInvoice={handleVerifyInvoice}
            onClearOrder={handleClearOrder}
            onAccountsChanged={refreshAccounts}
          />
        )}
        {activeTab === "info" && <InfoTab />}
      </main>
      <BottomNav active={activeTab} setActive={setActiveTab} />
    </div>
  );
}

export default App;
