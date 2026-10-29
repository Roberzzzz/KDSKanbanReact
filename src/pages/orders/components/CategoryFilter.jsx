// Botones para filtrar el menú por categoría.

function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  return (
    <nav className="orders-page__categories" aria-label="Categorías del menú">
      {categories.map((category) => {
        const isSelected = category === selectedCategory;

        return (
          <button
            key={category}
            type="button"
            className={
              isSelected
                ? "orders-page__category orders-page__category--active"
                : "orders-page__category"
            }
            aria-pressed={isSelected}
            onClick={() => onSelectCategory(category)}
          >
            
            {isSelected ? "✓ " : ""}
            {category}
          </button>
        );
      })}
    </nav>
  );
}

export default CategoryFilter;
