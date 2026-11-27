package ir.dooz.game;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;

import ir.myket.billingclient.IabHelper;
import ir.myket.billingclient.util.IabResult;
import ir.myket.billingclient.util.Purchase;
import ir.myket.billingclient.util.Security;
import ir.myket.billingclient.util.SkuDetails;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "DoozBilling")
public class DoozBillingPlugin extends Plugin {
    private static final String PRODUCT = BuildConfig.BILLING_PRODUCT_ID;
    private static final String RECEIPT = "receipt";
    private static final String SIGNATURE = "signature";

    private enum Action { OFFER, RESTORE, PURCHASE }

    private IabHelper helper;

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences preferences = preferences();
        call.resolve(status(isValid(preferences.getString(RECEIPT, ""), preferences.getString(SIGNATURE, ""))));
    }

    @PluginMethod
    public void getOffer(PluginCall call) {
        connect(call, Action.OFFER);
    }

    @PluginMethod
    public void restore(PluginCall call) {
        connect(call, Action.RESTORE);
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        connect(call, Action.PURCHASE);
    }

    private void connect(PluginCall call, Action action) {
        getActivity().runOnUiThread(() -> {
            if (BuildConfig.BILLING_PUBLIC_KEY.isEmpty()) {
                call.reject("Billing public key is missing", "NOT_CONFIGURED");
                return;
            }
            if (helper != null) {
                call.reject("Billing request already in progress", "BUSY");
                return;
            }
            try {
                IabHelper connection = new IabHelper(getContext(), BuildConfig.BILLING_PUBLIC_KEY);
                helper = connection;
                connection.startSetup(result -> getActivity().runOnUiThread(() -> {
                    if (helper != connection) return;
                    if (!result.isSuccess()) {
                        fail(call, "UNAVAILABLE");
                    } else if (action == Action.PURCHASE) {
                        startPurchase(call, connection);
                    } else {
                        query(call, connection, action == Action.OFFER);
                    }
                }));
            } catch (RuntimeException exception) {
                fail(call, "UNAVAILABLE");
            }
        });
    }

    private void query(PluginCall call, IabHelper connection, boolean includePrice) {
        try {
            connection.queryInventoryAsync(includePrice, Collections.singletonList(PRODUCT),
                (result, inventory) -> getActivity().runOnUiThread(() -> {
                    if (helper != connection) return;
                    if (!result.isSuccess() || inventory == null) {
                        fail(call, "UNAVAILABLE");
                        return;
                    }
                    Purchase purchase = inventory.getPurchase(PRODUCT);
                    if (purchase != null && !saveReceipt(purchase)) {
                        fail(call, "VERIFICATION_FAILED");
                        return;
                    }
                    if (purchase == null && !preferences().edit().remove(RECEIPT).remove(SIGNATURE).commit()) {
                        fail(call, "STORAGE_FAILED");
                        return;
                    }
                    JSObject response = status(purchase != null);
                    SkuDetails details = inventory.getSkuDetails(PRODUCT);
                    if (details != null) response.put("price", details.getPrice());
                    resolve(call, response);
                }));
        } catch (RuntimeException exception) {
            fail(call, "UNAVAILABLE");
        }
    }

    private void startPurchase(PluginCall call, IabHelper connection) {
        try {
            connection.launchPurchaseFlow(getActivity(), PRODUCT,
                (result, purchase) -> handlePurchase(call, connection, result, purchase));
        } catch (RuntimeException exception) {
            fail(call, "UNAVAILABLE");
        }
    }

    private void handlePurchase(PluginCall call, IabHelper connection, IabResult result, Purchase purchase) {
        getActivity().runOnUiThread(() -> {
            if (helper != connection) return;
            int code = result.getResponse();
            if (result.isSuccess() && purchase != null && saveReceipt(purchase)) {
                resolve(call, status(true));
            } else if (code == IabHelper.BILLING_RESPONSE_RESULT_ITEM_ALREADY_OWNED) {
                query(call, connection, false);
            } else if (code == IabHelper.BILLING_RESPONSE_RESULT_USER_CANCELED || code == IabHelper.IABHELPER_USER_CANCELLED) {
                fail(call, "CANCELED");
            } else {
                fail(call, "PURCHASE_FAILED");
            }
        });
    }

    private boolean saveReceipt(Purchase purchase) {
        String data = purchase.getOriginalJson();
        String signature = purchase.getSignature();
        return isValid(data, signature) && preferences().edit().putString(RECEIPT, data)
            .putString(SIGNATURE, signature).commit();
    }

    private boolean isValid(String data, String signature) {
        if (BuildConfig.BILLING_PUBLIC_KEY.isEmpty() || data == null || data.isEmpty()) return false;
        try {
            JSONObject receipt = new JSONObject(data);
            return PRODUCT.equals(receipt.optString("productId"))
                && getContext().getPackageName().equals(receipt.optString("packageName"))
                && receipt.optInt("purchaseState", -1) == 0
                && !receipt.optString("token", receipt.optString("purchaseToken")).isEmpty()
                && Security.verifyPurchase(BuildConfig.BILLING_PUBLIC_KEY, data, signature);
        } catch (JSONException | RuntimeException exception) {
            return false;
        }
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("dooz_billing_" + BuildConfig.FLAVOR, Context.MODE_PRIVATE);
    }

    private JSObject status(boolean owned) {
        return new JSObject().put("store", BuildConfig.FLAVOR)
            .put("configured", !BuildConfig.BILLING_PUBLIC_KEY.isEmpty()).put("owned", owned);
    }

    private void resolve(PluginCall call, JSObject response) {
        releaseHelper();
        call.resolve(response);
    }

    private void fail(PluginCall call, String code) {
        releaseHelper();
        call.reject("Store billing operation failed", code);
    }

    private void releaseHelper() {
        IabHelper connection = helper;
        helper = null;
        if (connection != null) connection.dispose();
    }

    @Override
    protected void handleOnDestroy() {
        releaseHelper();
    }
}
