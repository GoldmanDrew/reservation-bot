import { SnipeForm } from "@/components/SnipeForm";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Snipe a reservation</h2>
        <p className="mt-1 text-gray-500">
          Search a restaurant, set your preferred times, and let the bot grab the slot when it drops.
        </p>
      </div>
      <SnipeForm />
    </div>
  );
}
