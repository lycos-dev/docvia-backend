export default function WelcomeBanner() {
  return (
    <div className="bg-[#dbe7ff] dark:bg-blue-900/30 rounded-2xl p-6 flex items-center justify-between relative overflow-hidden transition-colors">
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
          Hello, John Doe!
        </h2>
        <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit,
          sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
      </div>

      <img
        src="/assets/images/penguin.png"
        alt="Reading"
        className="w-40 hidden md:block"
      />
    </div>
  );
}