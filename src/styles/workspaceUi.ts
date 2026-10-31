// Imported by deferred workspace routes. Public pages retain only their shared recipes.
import { publicRecipes } from './recipes.public';
import { workspaceRecipes } from './recipes.workspace';
const recipes = { ...publicRecipes, ...workspaceRecipes };
import { mergeUi } from './ui';
export { stagger } from './ui';
export function ui(...values: (string | false | null | undefined)[]): string {
    return mergeUi(recipes, ...values);
}
