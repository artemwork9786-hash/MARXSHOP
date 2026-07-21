import { useState } from "react";
import { ChevronDown } from "lucide-react";

const RULES = [
  {
    id: "entry",
    title: "Вход и устройства",
    items: [
      "Вход строго после проверки модератором.",
      "Доступны Android и Apple (iOS 17.7+).",
      "Нельзя менять флаг.",
      "Время указано по МСК.",
    ],
  },
  {
    id: "usage",
    title: "Использование аккаунта",
    items: [
      "Нельзя банить микрофон — штраф 400₽ / 200₴.",
      "Смена никнейма платно: 400₽ / 200₴. При аренде от 3000₽ или 1500₴ — смена ника в подарок.",
      "Нельзя тратить внутриигровые материалы.",
      "Нельзя донатить на аккаунт.",
      "Нельзя играть с софтами, конфигами, сторонними файлами, прошивкой.",
      "Нельзя портить репутацию аккаунта.",
    ],
  },
  {
    id: "time",
    title: "Время аренды",
    items: [
      "Ваше время идёт всегда — играете вы или нет.",
      "Перенос времени невозможен.",
      "Если вас выкинуло из-за ваших проблем с интернетом — повторный вход 100₽ / 50₴.",
    ],
  },
  {
    id: "payment",
    title: "Оплата и бронь",
    items: [
      "Бронь доплачивать не нужно — оплатите полную сумму и укажите время.",
      "На слово аккаунты не бронируются.",
      "Если не оплатили в течение 10 минут — аккаунт сдаётся другому.",
      "Если забронировали и не отписали в течение 1 часа — аренда сгорает.",
      "Принимаю оплату: РФ, Украина, Казахстан, PayPal, криптовалюта. Остальные способы — уточняйте.",
    ],
  },
  {
    id: "penalties",
    title: "Штрафы и возвраты",
    items: [
      "При отмене бронирования — возврат не делается.",
      "Отказ от проверки = черный список и без возврата средств.",
      "Если отказываетесь выполнять требования проверяющего — остаётесь без денег и аккаунта.",
      "Попытка украсть аккаунт = отказ в выдаче или штраф.",
      "Менеджер может выкинуть аренду без объяснения причины при подозрительных действиях.",
    ],
  },
  {
    id: "important",
    title: "Важное",
    items: [
      "Незнание правил не освобождает от ответственности.",
      "Всегда уточняйте реквизиты у того, кто сдаёт аренду — они могут быть не актуальными.",
      "При бане микрофона замена не выдаётся — уточняйте заранее.",
      "Все споры решаются через поддержку Telegram.",
    ],
  },
];

function AccordionItem({ rule, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#1A1A1A]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left cursor-pointer"
      >
        <span className="text-[15px] font-semibold text-white tracking-wide">
          {rule.title}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-neutral-500 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="space-y-2.5 px-4 pb-4">
            {rule.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-neutral-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function InfoTab() {
  const [openId, setOpenId] = useState(null);

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white tracking-wide uppercase">
          Правила аренды
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          Ознакомьтесь с условиями перед бронированием
        </p>
      </div>
      <div className="space-y-2.5">
        {RULES.map((rule) => (
          <AccordionItem
            key={rule.id}
            rule={rule}
            isOpen={openId === rule.id}
            onToggle={() => toggle(rule.id)}
          />
        ))}
      </div>
    </div>
  );
}
