import { redirect, useLoaderData } from "react-router";
import { authenticate } from "../../shopify.server";
import { createDiscountAutomaticApp, getSelectedDiscountFunctionsByHandle } from "../../model/new-wholesale.server";
import FormBulkBuy from "../../components/form-bulk-buy";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const appDiscountType = await getSelectedDiscountFunctionsByHandle({ admin, handle: params.handle });
  
  return { appDiscountType };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const input = Object.fromEntries(formData);

  try {
    const result = await createDiscountAutomaticApp({ admin, input });
    const discountId =
      result.discountAutomaticAppCreate.automaticAppDiscount.discountId;

    if (!discountId) {
      return { error: "Shopify did not return the new discount ID." };
    }

    return redirect(`/app/discounts/${discountId.split("/").at(-1)}`);
  } catch (error) {
    return { error: error.message };
  }
};

export default function NewDiscount() {
  const { appDiscountType } = useLoaderData();

  return (
    <s-page heading="Create discount">
      <FormBulkBuy type={appDiscountType} key="form-new" />
      {/* <s-section>
				<pre>LOG: {JSON.stringify({ appDiscountType }, null, 2)}</pre>
			</s-section> */}
    </s-page>
  );
}