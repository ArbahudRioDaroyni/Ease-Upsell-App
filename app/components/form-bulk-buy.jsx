/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

const buildSelectionIds = (value) => {
	const selection = value ?? [];
	const selectedIds = Array.isArray(selection)
		? selection
		: String(selection).split(",").filter(Boolean);
	return selectedIds.map((item) => (typeof item === "string" ? { id: item } : item));
}

const buildResources = (resources) => {
	return resources
		.map(({ id, title, image, images, status, totalVariants, productsCount }) => ({
			id,
			title,
			image: image ?? images ? images[0].originalSrc : undefined,
			status,
			detail: totalVariants
				? `${totalVariants} variant${totalVariants > 1 ? 's' : ''}` 
				: `${productsCount} product${productsCount > 1 ? 's' : ''}`
		}))
}

export default function FormBulkBuy({ config, discount, type }) {
	const fetcher = useFetcher();
	const shopify = useAppBridge();

	// Discount Type
	const [discountType, setDiscountType] = useState(config?.type?.title ?? "percentage");
	const [amountValue, setAmountValue] = useState(config?.type?.title === "amount" ? config?.type?.value : "");
	const [percentageValue, setPercentageValue] = useState(config?.type?.title === "percentage" ? config?.type?.value : "");
	const [amountError, setAmountError] = useState("");
	const [percentageError, setPercentageError] = useState("");

	// Discount TargetType
	const [discountTargetType, setDiscountTargetType] = useState(config?.target?.title ?? "product");
	const [discountTargetProducts, setDiscountTargetProducts] = useState(
		config?.target?.title == "product" && config?.target?.value.join(",")
	);
	const [discountTargetCollections, setDiscountTargetCollections] = useState(
		config?.target?.title == "collection" && config?.target?.value.join(",")
	);

	// Discount Requirement
	const [discountRequirement, setDiscountRequirement] = useState(config?.requirement?.title ?? "no");
	const productsRef = useRef(null);
	const collectionsRef = useRef(null);

	const [selectedResources, setSelectedResources] = useState(config?.resources || []);
	const [selectedResourceIds, setSelectedResourceIds] = useState(config?.resources?.map((resource) => ({ id: resource.id })) || []);
	const previousDiscountTargetType = useRef(discountTargetType);
	const previousSelectedResources = useRef(selectedResources);

	useEffect(() => {
		const targetTypeChanged = previousDiscountTargetType.current !== discountTargetType;
		const selectedResourcesChanged = previousSelectedResources.current !== selectedResources;

		previousDiscountTargetType.current = discountTargetType;
		previousSelectedResources.current = selectedResources;

		if (selectedResourcesChanged) {
			setSelectedResourceIds(selectedResources.map((resource) => ({ id: resource.id })));
		} else if (targetTypeChanged && discountTargetType === config?.target?.title) {
			setSelectedResourceIds(config?.resources?.map((resource) => ({ id: resource.id })) || []);
		} else if (targetTypeChanged) {
			setSelectedResourceIds([]);
		}
	}, [discountTargetType, selectedResources, config]);

	// Event openResourcePicker
	useEffect(() => {
		if (!productsRef.current) return;
		productsRef.current.value = discountTargetProducts;
		productsRef.current.dispatchEvent(new Event("input", { bubbles: true }));
	}, [discountTargetProducts]);

	useEffect(() => {
		if (!collectionsRef.current) return;
		collectionsRef.current.value = discountTargetCollections;
		collectionsRef.current.dispatchEvent(new Event("input", { bubbles: true }));
	}, [discountTargetCollections]);

	const openResourcePicker = async (query = "") => {
		const data = {
			type: discountTargetType,
			action: "select",
			multiple: true,
			query,
		}

		if (discountTargetType === "product") {
			if (config?.productIds) data.selectionIds = buildSelectionIds(config?.productIds);
			const resources = await shopify.resourcePicker(data);

			if (!resources) return;

			setDiscountTargetProducts(resources.map((resource) => resource.id).join(","));
			setSelectedResources(buildResources(resources));
		} else {
			if (config?.collectionIds) data.selectionIds = buildSelectionIds(config?.collectionIds);
			const resources = await shopify.resourcePicker(data);

			if (!resources) return;

			setDiscountTargetCollections(resources.map((resource) => resource.id).join(","));
			setSelectedResources(buildResources(resources));
		}
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const valueField = `discount-type-${discountType}-value`;
		const discountValue = formData.get(valueField);

		setAmountError("");
		setPercentageError("");
		if (!discountValue) {
			if (discountType === "amount") {
				setAmountError("Discount value can't be blank");
			} else {
				setPercentageError("Discount value can't be blank");
			}
			return;
		}

		formData.append("discount-resources", JSON.stringify(selectedResources));
		fetcher.submit(formData, { method: "post" });
	};

	const handleReset = (event) => {
		event.preventDefault();
		setSelectedResources(config?.resources || []);
		console.log("Handle discarded changes if necessary");
	};

	return (
		<form data-save-bar onSubmit={handleSubmit} onReset={handleReset}>
			<s-stack gap="large-300">
				{/* Discount Heading */}
				{discount ? (
					<s-stack direction="inline" alignItems="center" gap="small-100">
						<s-heading fontSize="large-300">{discount.title}</s-heading>
						<s-badge tone="success">{discount.status}</s-badge>
					</s-stack>
				) : (
					<s-heading fontSize="large-300">Create Discount</s-heading>
				)}

				{/* Discount Title */}
				<s-stack gap="base">
					<s-text fontSize="large" fontWeight="medium">
						{String(type && type[0]?.title || discount?.appDiscountType?.title)}
					</s-text>
					<s-section>
						<s-text-field
							label="Title"
							name="discount-title"
							value={discount?.title ?? ""}
							defaultValue={discount?.title ?? ""}
							placeholder="e.g: Bulk Buy 100, Buy 50+"
							required
							details="Customers will see this in their cart and at checkout."
						/>
					</s-section>
				</s-stack>


				{/* Discount value */}
				<s-stack gap="base">
					<s-text fontSize="large" fontWeight="medium">Discount value</s-text>
					<s-section>
						<s-stack gap="base">
							{/* Discount Type */}
							<s-grid gridTemplateColumns="2fr 1fr" gap="small-200">
								<s-select
									label="Discount type"
									labelAccessibilityVisibility="exclusive"
									name="discount-type"
									value={discountType}
									onChange={(event) => {
										setDiscountType(event.currentTarget.value);
										setAmountError("");
										setPercentageError("");
									}}
								>
									<s-option value="percentage" selected={discountType == "percentage"}>Percentage</s-option>
									<s-option value="amount" selected={discountType == "amount"}>Fixed amount</s-option>
								</s-select>
								{discountType === "percentage" ? (
									<s-number-field
										label="Percentage off"
										labelAccessibilityVisibility="exclusive"
										name="discount-type-percentage-value"
										value={percentageValue}
										defaultValue={percentageValue}
										suffix="%"
										inputMode="numeric"
										step="1"
										min="1"
										placeholder="0"
										required
										error={percentageError}
										onChange={(event) => {
											const next = event.currentTarget.value;
											setPercentageValue(next);
											if (next) setPercentageError("");
										}}
									/>
								) : (
									<s-money-field
										label="Amount off"
										labelAccessibilityVisibility="exclusive"
										name="discount-type-amount-value"
										value={amountValue}
										defaultValue={amountValue}
										placeholder="0.00"
										min="0"
										required
										error={amountError}
										onChange={(event) => {
											const next = event.currentTarget.value;
											setAmountValue(next);
											if (next) setAmountError("");
										}}
									/>
								)}
							</s-grid>

							{/* Applies to */}
							<s-stack gap="base">
								<s-stack gap="small-300">
									<s-text fontWeight="medium">Applies to</s-text>
									<s-select
										label="Target type"
										labelAccessibilityVisibility="exclusive"
										name="discount-target"
										value={discountTargetType}
										onChange={(event) =>
											setDiscountTargetType(event.currentTarget.value)
										}
									>
										<s-option value="product" selected={discountTargetType == "product"}>Specific Products</s-option>
										<s-option value="collection" selected={discountTargetType == "collection"}>Specific Collections</s-option>
									</s-select>
								</s-stack>

								{discountTargetType === "product" ? (
									<>
										<s-stack display="none">
											<s-text-field
												ref={productsRef}
												label="Selected products"
												name="discount-target-products[]"
												defaultValue={
													config?.target?.title == "product" && config?.target?.value.join(",")
												}
											/>
										</s-stack>
										<s-grid gridTemplateColumns="2fr auto" gap="small-200">
											<s-text-field
												label="Search products"
												labelAccessibilityVisibility="exclusive"
												icon="search"
												placeholder="Search products"
												onInput={(event) =>
													event.isTrusted &&
													openResourcePicker(event.currentTarget.value)
												}
											/>
											<s-button
												type="button"
												variant="primary"
												onClick={() => openResourcePicker()}
											>
												Browse
											</s-button>
										</s-grid>
									</>
								) : (
									<>
										<s-stack display="none">
											<s-text-field
												ref={collectionsRef}
												label="Selected collections"
												name="discount-target-collections[]"
												defaultValue={
													config?.target?.title == "collection" && config?.target?.value.join(",")
												}
											/>
										</s-stack>
										<s-grid gridTemplateColumns="2fr auto" gap="small-200">
											<s-text-field
												label="Search collections"
												labelAccessibilityVisibility="exclusive"
												icon="search"
												placeholder="Search collections"
												onInput={(event) =>
													event.isTrusted &&
													openResourcePicker(event.currentTarget.value)
												}
											/>
											<s-button
												type="button"
												variant="primary"
												onClick={() => openResourcePicker()}
											>
												Browse
											</s-button>
										</s-grid>
									</>
								)}
							</s-stack>

							{/* Discount Target Preview */}
							<s-stack border="base subdued solid" borderRadius="base">
								{selectedResources.map((preview) => (
									<>
										<s-grid
											key={preview.id}
											gridTemplateColumns="auto 1fr auto"
											alignItems="center"
											gap="small"
											paddingBlock="small"
											paddingInline="base"
										>
											{preview.image || preview.images ? (
												<s-thumbnail src={preview.image || preview.images[0].originalSrc} alt="No image available" size="small"></s-thumbnail>
											) : (
												<s-thumbnail alt="No image available" size="small"></s-thumbnail>
											)}
											<s-stack gap="small-300">
												<s-text fontSize="small">{preview.title}</s-text>
												<s-text fontSize="small" color="subdued">{preview.detail}</s-text>
											</s-stack>
											<s-icon type="x"></s-icon>
										</s-grid>
										<s-divider></s-divider>
									</>
								))}
							</s-stack>
						</s-stack>
					</s-section>
				</s-stack>

				{/* Discount Requirements */}
				<s-stack gap="base">
					<s-text fontSize="large" fontWeight="medium">Minimum purchase requirements</s-text>
					<s-section>
						<s-choice-list
							label="Minimum purchase requirement"
							labelAccessibilityVisibility="exclusive"
							name="discount-requirement"
							values={[discountRequirement]}
							onChange={(event) =>
								setDiscountRequirement(event.currentTarget.values[0])
							}
						>
							<s-choice value="no">No minimum requirements</s-choice>
							<s-choice value="amount">
								Minimum purchase amount
								<s-stack
									slot="secondary-content"
									inlineSize="160px"
									display={discountRequirement === "amount" ? "auto" : "none"}
								>
									<s-money-field
										label="Minimum purchase amount"
										labelAccessibilityVisibility="exclusive"
										name="discount-requirement-amount-value"
										value={
											config?.requirement?.title === "amount"
												? config?.requirement.value
												: ""
										}
										defaultValue={
											config?.requirement?.title === "amount"
												? config?.requirement.value
												: ""
										}
										placeholder="0.00"
										min="0"
									/>
								</s-stack>
							</s-choice>
							<s-choice value="quantity">
								Minimum quantity of items
								<s-stack
									slot="secondary-content"
									inlineSize="160px"
									display={
										discountRequirement === "quantity" ? "auto" : "none"
									}
								>
									<s-number-field
										label="Minimum quantity"
										labelAccessibilityVisibility="exclusive"
										name="discount-requirement-quantity-value"
										value={
											config?.requirement?.title === "quantity"
												? config?.requirement.value
												: ""
										}
										defaultValue={
											config?.requirement?.title === "quantity"
												? config?.requirement.value
												: ""
										}
										placeholder="0"
										step="1"
										min="1"
									/>
								</s-stack>
							</s-choice>
						</s-choice-list>
					</s-section>
				</s-stack>

				{fetcher?.data?.error && (
					<s-section>
						<s-banner tone="critical">{fetcher.data.error}</s-banner>
					</s-section>
				)}

				<s-section>
					<pre>selectedResources: {JSON.stringify(selectedResources, null, 2)}</pre>
					<pre>selectedResourceIds: {JSON.stringify(selectedResourceIds, null, 2)}</pre>
					<pre>LOG: {JSON.stringify({ config, discount, type, discountTargetCollections }, null, 2)}</pre>
				</s-section>
			</s-stack>
		</form>
	);
}
