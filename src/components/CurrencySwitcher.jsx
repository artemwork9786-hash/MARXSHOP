import { CURRENCIES } from "../data/accounts";

export default function CurrencySwitcher({ currency, setCurrency }) {
  return (
    <div className="mx-4 mb-4 mt-2 flex rounded-xl bg-neutral-900 p-1">
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code)}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold tracking-wider transition-all cursor-pointer ${
            currency === c.code
              ? "bg-white text-black shadow-lg"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
