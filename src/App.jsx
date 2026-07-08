import { useState, useEffect, useCallback, useRef } from "react";
import Header from "./components/Header";
import CurrencySwitcher from "./components/CurrencySwitcher";
import AccountCard from "./components/AccountCard";
import BottomNav from "./components/BottomNav";
import InfoTab from "./components/InfoTab";
import ProfileTab from "./components/ProfileTab";
import { mockAccounts, CURRENCIES } from "./data/accounts";
import { createOrder, checkOrder, confirmSbp, cancelOrder } from "./api";

function ShopTab({ currency, setCurrency, onRent }) {
  return (
    <>
      <CurrencySwitcher currency={currency} setCurrency={setCurrency} />
      <div className="grid grid-cols-1 gap-6 px-4 md:grid-cols-2 lg:grid-cols-3">
        {mockAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            currency={currency}
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
  const [orderStatus, setOrderStatus] = useState(null); // null | "pending" | "paid" | "awaiting_verification"
  const [paymentMethod, setPaymentMethod] = useState(null); // "crypto" | "sbp"
  const [orderId, setOrderId] = useState(null);
  const [payUrl, setPayUrl] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const mainButtonRef = useRef(null);
  const pollingRef = useRef(null);

  // Telegram init
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      document.body.style.backgroundColor =
        tg.themeParams?.bg_color || "#0A0A0A";
    }
  }, []);

  // Polling for order status
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
            stopPolling();
          } else if (res.status === "EXPIRED") {
            setActiveOrder(null);
            setOrderStatus(null);
            setPaymentMethod(null);
            setOrderId(null);
            setPayUrl(null);
            setPaymentDetails(null);
            stopPolling();
          }
        } catch {
          // retry next tick
        }
      }, 3000);
    },
    [stopPolling]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // MainButton click handler — for SBP "I paid" confirmation
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
        // retry
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

  // Payment countdown (only while pending)
  useEffect(() => {
    if (!activeOrder || orderStatus !== "pending" || paymentTimer <= 0) return;
    const id = setInterval(() => {
      setPaymentTimer((t) => {
        if (t <= 1) {
          setActiveOrder(null);
          setOrderStatus(null);
          setPaymentMethod(null);
          setOrderId(null);
          setPayUrl(null);
          setPaymentDetails(null);
          stopPolling();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeOrder, orderStatus, paymentTimer, stopPolling]);

  // Step 1: Select account, show method selector
  const handleRent = useCallback(
    (account) => {
      setActiveOrder(account);
      setPaymentMethod(null);
      setOrderId(null);
      setPayUrl(null);
      setPaymentDetails(null);
      setOrderStatus(null);
      setActiveTab("profile");
    },
    []
  );

  // Step 2: Method chosen — create order on backend
  const handleSelectMethod = useCallback(
    async (method) => {
      if (!activeOrder) return;
      const tgInitData = window.Telegram?.WebApp?.initData || "";
      try {
        const res = await createOrder({
          accountId: activeOrder.id,
          currency,
          method,
          tgInitData,
        });

        setOrderId(res.orderId);
        setPaymentMethod(method);
        setPaymentTimer(600);
        setOrderStatus("pending");

        if (method === "crypto") {
          setPayUrl(res.payUrl);
          setPaymentDetails(null);
          window.Telegram?.WebApp?.openLink(res.payUrl);
          startPolling(res.orderId);
        } else {
          setPayUrl(null);
          setPaymentDetails(res.paymentDetails);
        }
      } catch (err) {
        console.error("Failed to create order:", err);
      }
    },
    [activeOrder, currency, startPolling]
  );

  const handleClearOrder = useCallback(async () => {
    if (activeOrder) {
      try {
        await cancelOrder(activeOrder.id);
      } catch {
        // ignore
      }
    }
    setActiveOrder(null);
    setOrderStatus(null);
    setPaymentMethod(null);
    setOrderId(null);
    setPayUrl(null);
    setPaymentDetails(null);
    setPaymentTimer(600);
    stopPolling();
    const tg = window.Telegram?.WebApp;
    tg?.MainButton?.hide();
  }, [activeOrder, stopPolling]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0A0A0A]">
      <Header />
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === "shop" && (
          <ShopTab currency={currency} setCurrency={setCurrency} onRent={handleRent} />
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
            onSelectMethod={handleSelectMethod}
            onClearOrder={handleClearOrder}
          />
        )}
        {activeTab === "info" && <InfoTab />}
      </main>
      <BottomNav active={activeTab} setActive={setActiveTab} />
    </div>
  );
}

export default App;
