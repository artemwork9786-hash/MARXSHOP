import { useState } from "react";
import { ChevronDown } from "lucide-react";

const RULES = [
  {
    id: "bans",
    title: "Важные запреты",
    items: [
      "Запрещено использование любых сторонних софтов (читы, моды, ассистенты). Бан навсегда без возврата.",
      "Не меняйте никнейм, аватар или любые данные профиля — это нарушает условия аренды.",
      "Тратите внутриигровые материалы (UC, фарм, кристаллы) строго по назначению аккаунта.",
      "Не передавайте данные от аккаунта третьим лицам — это приводит к блокировке.",
      "Нарушение репутации аккаунта (жалобы, баны чатов) ведёт к штрафам.",
    ],
  },
  {
    id: "devices",
    title: "Правила входа и устройства",
    items: [
      "Доступны устройства на Android и iOS. Рекомендуется Android для стабильности.",
      "Вход разрешён только после проверки модератором — дождитесь подтверждения.",
      "Используйте только одну сессию одновременно — мультилогин запрещён.",
      "Не привязывайте аккаунт к своему номеру телефона или почте.",
      "Выходите из аккаунта через приложение, а не просто закрывайте его.",
    ],
  },
  {
    id: "payment",
    title: "Оплата, бронь и возвраты",
    items: [
      "После бронирования у вас 10 минут на оплату — иначе бронь автоматически снимается.",
      "Отмена брони возможна в течение 5 минут после создания, если аккаунт ещё не выдан.",
      "Возврат средств не производится после получения данных от аккаунта.",
      "Оплата производится только через Telegram-бот — другие способы не принимаются.",
      "Цены фиксированы и не подлежат торгу.",
    ],
  },
  {
    id: "penalties",
    title: "Штрафы и форс-мажоры",
    items: [
      "Бан микрофона в игре — штраф 500₽ / 270₴ / 6$ за инцидент.",
      "Вылеты из-за проблем с вашим интернетом не считаются техническими сбоями.",
      "При бане аккаунта по вашей вине — штраф равный стоимости аренды.",
      "Форс-мажор (бан сервера, глобальные сбои) — перерасчёт или компенсация по решению модератора.",
      "Все споры решаются через поддержку Telegram — не пытайтесь решить вопрос самостоятельно.",
    ],
  },
];

function AccordionItem({ rule, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#1A1A1A]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-white tracking-wide">
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
              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-400">
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
        <p className="mt-1 text-xs text-neutral-500">
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
