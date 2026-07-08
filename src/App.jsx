import { useState, useEffect, useCallback, useRef } from "react";
import Header from "./components/Header";
import CurrencySwitcher from "./components/CurrencySwitcher";
import AccountCard from "./components/AccountCard";
import BottomNav from "./components/BottomNav";
import InfoTab from "./components/InfoTab";
import ProfileTab from "./components/ProfileTab";
import { mockAccounts, CURRENCIES } from "./data/accounts";
import { createOrder } from "./api";

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
  const [orderStatus, setOrderStatus] = useState(null); // null | "pending" | "paid"
  const mainButtonRef = useRef(null);

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

  // MainButton click handler
  const handleMainButtonClick = useCallback(() => {
    if (orderStatus === "pending") {
      setOrderStatus("paid");
      const tg = window.Telegram?.WebApp;
      if (tg?.MainButton) {
        tg.MainButton.setText("✓ ОПЛАЧЕНО");
        tg.MainButton.offClick(handleMainButtonClick);
      }
    }
  }, [orderStatus]);

  // MainButton sync
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.MainButton) return;

    if (activeOrder && orderStatus === "pending") {
      const curr = CURRENCIES.find((c) => c.code === currency);
      const price = activeOrder.prices[currency.toLowerCase()];
      tg.MainButton.setText(`ОПЛАТИТЬ В КРИПТЕ (${price.toLocaleString("ru-RU")} ${curr.symbol})`);
      tg.MainButton.show();
      tg.MainButton.onClick(handleMainButtonClick);
      mainButtonRef.current = handleMainButtonClick;
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
  }, [activeOrder, orderStatus, currency, handleMainButtonClick]);

  // Payment countdown (only while pending)
  useEffect(() => {
    if (!activeOrder || orderStatus !== "pending" || paymentTimer <= 0) return;
    const id = setInterval(() => {
      setPaymentTimer((t) => {
        if (t <= 1) {
          setActiveOrder(null);
          setOrderStatus(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeOrder, orderStatus, paymentTimer]);

  const handleRent = useCallback(
    async (account) => {
      try {
        await createOrder(account);
      } catch {
        // API call failed — proceed with local state anyway
      }
      setActiveOrder(account);
      setPaymentTimer(600);
      setOrderStatus("pending");
      setActiveTab("profile");
    },
    []
  );

  const handleClearOrder = useCallback(() => {
    setActiveOrder(null);
    setOrderStatus(null);
    setPaymentTimer(600);
    const tg = window.Telegram?.WebApp;
    tg?.MainButton?.hide();
  }, []);

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
          />
        )}
        {activeTab === "info" && <InfoTab />}
      </main>
      <BottomNav active={activeTab} setActive={setActiveTab} />
    </div>
  );
}

export default App;
